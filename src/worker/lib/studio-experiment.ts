import { createFlagsmithInstance } from '@flagsmith/flagsmith/isomorphic';
import { z } from 'zod';
import type { ChatSuggestion } from '../../shared/chat-suggestions';
import {
  STUDIO_EXPERIMENT_FLAG,
  STUDIO_SUGGESTION_EVENT,
  type StudioExperimentEvent,
  type StudioVariant,
} from '../../shared/studio-experiment';
import type { Env } from '../env';
import { workspaceDigest } from './workspace-results';

const variants = z.enum(['control', 'brain']);
const ticketSchema = z.object({
  creatorId: z.string(),
  projectId: z.string(),
  experimentId: z.number().int().positive(),
  key: z.string().min(1).max(80),
  variant: variants,
  expiresAt: z.number(),
});
type Ticket = z.infer<typeof ticketSchema>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const textToken = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const tokenBytes = (value: string) =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));

function signingKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}
async function sign(key: CryptoKey, content: string) {
  return textToken(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(content))));
}
function runtimeConfig(env: Env) {
  return env.FLAGSMITH_SDK_KEY && env.FLAGSMITH_IDENTITY_SECRET && env.FLAGSMITH_IDENTITY_SECRET.length >= 32
    ? { environment: env.FLAGSMITH_SDK_KEY, secret: env.FLAGSMITH_IDENTITY_SECRET }
    : null;
}

export function flagsmithEndpoint(configured: string | undefined, fallback: string, production: boolean) {
  const url = new URL(configured || fallback);
  const local = !production && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid Flagsmith API URL');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

function flagsmithFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(1800) });
}
function flagsmithIdentity(key: CryptoKey, environment: string, creatorId: string) {
  return sign(key, JSON.stringify(['identity-v1', environment, creatorId])).then((hash) => 'cb_' + hash);
}

export async function studioAssignment(
  env: Env,
  creatorId: string,
  projectId: string
): Promise<{ variant: StudioVariant; ticket?: string } | null> {
  const config = runtimeConfig(env);
  if (!config) return null;
  const client = createFlagsmithInstance();
  try {
    const key = await signingKey(config.secret);
    const identifier = await flagsmithIdentity(key, config.environment, creatorId);
    await client.init({
      api: flagsmithEndpoint(
        env.FLAGSMITH_EDGE_API,
        'https://edge.api.flagsmith.com/api/v1/',
        env.ENVIRONMENT === 'production'
      ).href,
      environmentID: config.environment,
      identity: identifier,
      fetch: flagsmithFetch,
    });
    const flag = client.getAllFlags()[STUDIO_EXPERIMENT_FLAG];
    const variant = variants.safeParse(flag?.value);
    if (!flag?.enabled || !variant.success) return null;
    if (
      !flag.experiment?.inExperiment ||
      !flag.variant ||
      !Number.isSafeInteger(flag.experiment.id) ||
      flag.experiment.id < 1
    )
      return { variant: variant.data };
    const body = textToken(
      encoder.encode(
        JSON.stringify({
          creatorId,
          projectId,
          experimentId: flag.experiment.id,
          key: flag.variant,
          variant: variant.data,
          expiresAt: Date.now() + 2 * 3600000,
        } satisfies Ticket)
      )
    );
    const mac = await sign(key, JSON.stringify(['ticket-v1', config.environment, body]));
    return { variant: variant.data, ticket: body + '.' + mac };
  } catch {
    // Keep the current Studio experience when Flagsmith is unavailable.
    return null;
  } finally {
    await client.close(0);
  }
}

export async function verifyStudioTicket(env: Env, creatorId: string, value: string) {
  const config = runtimeConfig(env);
  if (!config) return null;
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra || !/^[\w-]+$/.test(body) || !/^[\w-]+$/.test(signature)) return null;
  try {
    const key = await signingKey(config.secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      tokenBytes(signature),
      encoder.encode(JSON.stringify(['ticket-v1', config.environment, body]))
    );
    if (!valid) return null;
    const parsed = ticketSchema.safeParse(JSON.parse(decoder.decode(tokenBytes(body))));
    if (!parsed.success || parsed.data.creatorId !== creatorId || parsed.data.expiresAt <= Date.now()) return null;
    return {
      ticket: parsed.data,
      environment: config.environment,
      identifier: await flagsmithIdentity(key, config.environment, creatorId),
    };
  } catch {
    return null;
  }
}

export class ExperimentEventPending extends Error {}
export class ExperimentAssignmentChanged extends Error {}

export async function deliverStudioEvent(
  env: Env,
  assignment: NonNullable<Awaited<ReturnType<typeof verifyStudioTicket>>>,
  event: StudioExperimentEvent
) {
  const { ticket, environment, identifier } = assignment;
  const experimentKey = await workspaceDigest([environment, ticket.experimentId]);
  const record = async (kind: StudioExperimentEvent) => {
    const db = env.DB;
    const now = Date.now();
    const claim = crypto.randomUUID();
    const saved = await db
      .prepare(
        `INSERT INTO studio_experiment_events (creator_id,experiment_key,event_type,variant_key,claim,lease_until)
       VALUES (?,?,?,?,?,?) ON CONFLICT(creator_id,experiment_key,event_type)
       DO UPDATE SET variant_key=excluded.variant_key,claim=excluded.claim,lease_until=excluded.lease_until
       WHERE studio_experiment_events.delivered_at IS NULL AND studio_experiment_events.lease_until<=?`
      )
      .bind(ticket.creatorId, experimentKey, kind, ticket.key, claim, now + 12_000, now)
      .run();
    if (!saved.meta.changes) {
      const row = await db
        .prepare(
          'SELECT delivered_at,variant_key FROM studio_experiment_events WHERE creator_id=? AND experiment_key=? AND event_type=?'
        )
        .bind(ticket.creatorId, experimentKey, kind)
        .first<{ delivered_at: string | null; variant_key: string }>();
      if (row?.delivered_at) {
        if (row.variant_key !== ticket.key) throw new ExperimentAssignmentChanged();
        return;
      }
      throw new ExperimentEventPending();
    }
    try {
      const endpoint = flagsmithEndpoint(
        env.FLAGSMITH_EVENTS_API,
        'https://events.api.flagsmith.com/',
        env.ENVIRONMENT === 'production'
      );
      // Use the Flagsmith SDK's event envelope, with an acknowledged request to safely retry failures.
      const response = await flagsmithFetch(new URL('v1/events', endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Environment-Key': environment },
        body: JSON.stringify({
          events: [
            {
              event: kind === 'seen' ? '$flag_exposure' : STUDIO_SUGGESTION_EVENT,
              feature_name: kind === 'seen' ? STUDIO_EXPERIMENT_FLAG : null,
              identifier,
              value: kind === 'seen' ? ticket.key : null,
              traits: null,
              metadata: { surface: 'studio' },
              timestamp: now,
            },
          ],
        }),
      });
      if (!response.ok) throw new Error('Flagsmith events API returned an error.');
      await db
        .prepare(
          'UPDATE studio_experiment_events SET delivered_at=? WHERE creator_id=? AND experiment_key=? AND event_type=? AND claim=?'
        )
        .bind(new Date().toISOString(), ticket.creatorId, experimentKey, kind, claim)
        .run();
    } catch (error) {
      await db
        .prepare(
          'DELETE FROM studio_experiment_events WHERE creator_id=? AND experiment_key=? AND event_type=? AND claim=? AND delivered_at IS NULL'
        )
        .bind(ticket.creatorId, experimentKey, kind, claim)
        .run()
        .catch(() => {});
      throw error;
    }
  };
  await record('seen');
  if (event === 'sent') await record('sent');
}

const generalSuggestions: ChatSuggestion[] = [
  {
    id: 'studio-intro',
    label: 'Write an opening',
    prompt: 'Write three opening hooks for this video.',
    reason: 'Start with the line that gets viewers into the story.',
  },
  {
    id: 'studio-script',
    label: 'Draft a Short script',
    prompt: 'Write a 45-second Short for this project.',
    reason: 'Turn this project into a short video.',
  },
  {
    id: 'studio-packaging',
    label: 'Draft a title',
    prompt: 'Write five possible titles for this video.',
    reason: 'Explore ways to describe the video clearly.',
  },
];

export function studioSuggestions(grounded: ChatSuggestion[], variant: StudioVariant) {
  return variant === 'control' ? generalSuggestions : [...grounded, ...generalSuggestions].slice(0, 3);
}
