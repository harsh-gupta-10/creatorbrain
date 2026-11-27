import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/worker/env';
import {
  deliverStudioEvent,
  ExperimentAssignmentChanged,
  studioAssignment,
  studioSuggestions,
  verifyStudioTicket,
} from '../src/worker/lib/studio-experiment';
import {
  applyExperimentApproval,
  experimentReadout,
  proposeExperimentChange,
  explicitRolloutIntent,
} from '../src/worker/lib/flagsmith-operator';

const databases: DatabaseSync[] = [];
function testEnv() {
  const sql = new DatabaseSync(':memory:');
  databases.push(sql);
  sql.exec("CREATE TABLE creators (id TEXT PRIMARY KEY); INSERT INTO creators (id) VALUES ('alice'),('bob');");
  sql.exec(readFileSync('migrations/0014_studio_experiments.sql', 'utf8'));
  const db = {
    prepare(query: string) {
      const statement = sql.prepare(query);
      return {
        bind: (...values: SQLInputValue[]) => ({
          first: async () => statement.get(...values) || null,
          run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
        }),
      };
    },
  } as unknown as D1Database;
  return {
    DB: db,
    FLAGSMITH_SDK_KEY: 'demo-sdk-id',
    FLAGSMITH_IDENTITY_SECRET: 'test-only-identity-signing-key-for-harness',
    FLAGSMITH_OPERATOR_CREATOR_ID: 'alice',
    FLAGSMITH_EXPERIMENT_ID: '14',
    FLAGSMITH_MANAGEMENT_KEY: 'test-only-management-key',
  } as Env;
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const db of databases.splice(0)) db.close();
});

describe('Studio suggestion experiment', () => {
  it('uses the Flagsmith variation, signs owner-scoped tickets, and sends exposure and success only once', async () => {
    const env = testEnv();
    let variant = 'brain';
    const events: { event: string; identifier: string; value: unknown }[] = [];
    let assignedIdentity = '';
    const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/v1/identities/') {
        assignedIdentity = url.searchParams.get('identifier') || '';
        expect(assignedIdentity).toMatch(/^cb_[\w-]+$/);
        expect(assignedIdentity).not.toContain('alice');
        return Response.json({
          identifier: assignedIdentity,
          flags: [
            {
              enabled: true,
              feature_state_value: variant,
              variant,
              feature: { id: 3, name: 'studio_next_steps' },
              metadata: { experiment: { id: 14, name: 'Studio', in_experiment: true } },
            },
          ],
        });
      }
      expect(url.href).toBe('https://events.api.flagsmith.com/v1/events');
      events.push(...JSON.parse(String(init?.body)).events);
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal('fetch', fetchStub);
    const assignment = await studioAssignment(env, 'alice', 'proj-a');
    expect(assignment).toMatchObject({ variant: 'brain', ticket: expect.any(String) });
    expect(events).toHaveLength(0);
    const signed = assignment!.ticket!;
    expect(await verifyStudioTicket(env, 'bob', signed)).toBeNull();
    expect(await verifyStudioTicket(env, 'alice', 'A' + signed)).toBeNull();
    const verified = await verifyStudioTicket(env, 'alice', signed);
    await deliverStudioEvent(env, verified!, 'sent');
    await deliverStudioEvent(env, verified!, 'seen');
    await deliverStudioEvent(env, verified!, 'sent');
    expect(events).toMatchObject([
      { event: '$flag_exposure', identifier: assignedIdentity, value: 'brain' },
      { event: 'studio_suggestion_sent', identifier: assignedIdentity, value: null },
    ]);
    variant = 'control';
    const changed = await studioAssignment(env, 'alice', 'proj-a');
    expect(changed?.variant).toBe('control');
    await expect(
      deliverStudioEvent(env, (await verifyStudioTicket(env, 'alice', changed!.ticket!))!, 'sent')
    ).rejects.toBeInstanceOf(ExperimentAssignmentChanged);
  });

  it('keeps the layout comparable while only the treatment uses Brain evidence', () => {
    const grounded = [
      { id: 'brain', label: 'Apply a finding', prompt: 'Use my Brain finding.', reason: 'Brain recorded this.' },
    ];
    expect(studioSuggestions(grounded, 'control')).toHaveLength(3);
    expect(studioSuggestions(grounded, 'control')).not.toContainEqual(grounded[0]);
    expect(studioSuggestions(grounded, 'brain')).toHaveLength(3);
    expect(studioSuggestions(grounded, 'brain')[0]).toBe(grounded[0]);
  });
});

function mockManagement() {
  let status = 'running';
  let revision = 1;
  let probability = 0.98;
  const writes: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.origin).toBe('https://api.flagsmith.com');
      expect(url.pathname).toContain('/experiments/14/');
      if (init?.method === 'POST') {
        writes.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
        status = url.pathname.endsWith('complete/') ? 'completed' : 'paused';
        return Response.json({});
      }
      if (url.pathname.endsWith('results/'))
        return Response.json({
          results: {
            as_of: '2026-11-28T00:00:00Z',
            payload: {
              srm_p_value: 1,
              metrics: [
                {
                  metric_id: 5,
                  variants: { control: { n: 120, sum: 24 }, brain: { n: 120, sum: 49 } },
                  inference: { brain: { chance_to_win: probability } },
                },
              ],
            },
          },
        });
      return Response.json({
        id: 14,
        name: 'Studio',
        hypothesis: 'More sends',
        status,
        updated_at: 'revision-' + revision,
        feature: {
          id: 3,
          name: 'studio_next_steps',
          multivariate_options: [{ id: 7, key: 'brain', string_value: 'brain' }],
        },
        metrics: [{ id: 5, metric: 6, metric_name: 'Studio suggestion sent', aggregation: 'occurrence' }],
      });
    })
  );
  return {
    writes,
    revise: () => revision++,
    changeResult: () => {
      probability = 0.62;
    },
  };
}

describe('Flagsmith rollout operator', () => {
  it('shows actual rates, suggests a rollout, and calls Flagsmith only after a one-time owner approval', async () => {
    const env = testEnv();
    const provider = mockManagement();
    await expect(experimentReadout(env, 'bob', false)).rejects.toMatchObject({ statusCode: 404 });
    await expect(experimentReadout(env, 'alice', true)).rejects.toMatchObject({ statusCode: 404 });
    const result = await proposeExperimentChange(env, 'alice', false, 'Roll out the winner');
    expect(result.summary.variants).toMatchObject([
      { key: 'control', exposures: 120, converters: 24 },
      { key: 'brain', exposures: 120, converters: 49, probability: 0.98 },
    ]);
    expect(result.proposal?.action).toBe('rollout_brain');
    expect(provider.writes).toEqual([]);
    const ticket = result.proposal!.approvalId;
    await expect(applyExperimentApproval(env, 'alice', false, ticket)).resolves.toEqual({ success: true });
    expect(provider.writes).toEqual([
      {
        path: '/api/v1/environments/demo-sdk-id/experiments/14/complete/',
        body: { rollout_decision: 'variant', rollout_variant: 7 },
      },
    ]);
    await expect(applyExperimentApproval(env, 'alice', false, ticket)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('blocks stale previews and rechecks the results before shipping an agent-proposed winner', async () => {
    const env = testEnv();
    const provider = mockManagement();
    const pause = await proposeExperimentChange(env, 'alice', false, 'Pause the experiment');
    provider.revise();
    await expect(applyExperimentApproval(env, 'alice', false, pause.proposal!.approvalId)).rejects.toMatchObject({
      statusCode: 409,
    });
    const winner = await proposeExperimentChange(env, 'alice', false, 'Roll out the winner');
    provider.changeResult();
    await expect(applyExperimentApproval(env, 'alice', false, winner.proposal!.approvalId)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(provider.writes).toEqual([]);
    expect(explicitRolloutIntent("Don't pause the experiment")).toBe('explain');
  });
});
