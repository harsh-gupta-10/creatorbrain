import { readWatchReview, updateWatchReview } from '../lib/competitor-watch';
import { WorkspaceResultBusy } from '../lib/workspace-results';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';

import { runOrchestrator, runMemoryCurator } from '../agents/definitions/tutorAndCurriculum';

import type { SavedAgent } from '../../shared/agents';
import { z } from 'zod';
import { runSavedAgent, AgentRunError } from '../agents/saved';

export const agentConfig = z
  .object({
    name: z.string().trim().min(1).max(80),
    kind: z.enum(['competitor', 'titles', 'short_script', 'full_script']),
    focus: z.string().trim().min(1).max(1200),
    channel: z.string().trim().max(220).default(''),
  })
  .refine(
    (v) =>
      v.kind !== 'competitor' ||
      /^(?:(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/UC[\w-]{22}|@[\w.-]+)\/?|@[\w.-]+|UC[\w-]{22})$/i.test(
        v.channel
      ),
    { message: 'Enter a YouTube @handle or channel URL.' }
  );

export const agentsRoutes = new Hono<AppEnv>();

// Get agent traces timeline
agentsRoutes.get('/traces', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const traces = await dbClient.getAgentTraces(creator.id, 50);

  return c.json({ traces });
});

// "Run agents now" button - triggers autonomous Orchestrator & Memory Curator
agentsRoutes.post('/run-now', async (c) => {
  const creator = c.get('creator');

  const orchestratorResult = await runOrchestrator(creator.id, c.env.DB);
  const learningInsight = await runMemoryCurator(creator.id, c.env.DB);

  // Record agent trace
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO agent_traces (
        id, creator_id, agent_name, task_description, step_number, total_steps,
        tool_called, tool_input, tool_result, output_summary, status, created_at
      ) VALUES (?, ?, 'Orchestrator', 'Evaluate channel growth bottlenecks & update next best action', 1, 1, 'evaluateChannelHealth', ?, ?, ?, 'success', ?)`
  )
    .bind(
      crypto.randomUUID(),
      creator.id,
      JSON.stringify({ creatorId: creator.id }),
      JSON.stringify(orchestratorResult),
      `Orchestrator determined next best action: "${orchestratorResult.nextBestAction}".`,
      now
    )
    .run();

  const dbClient = new DBClient(c.env.DB);
  const traces = await dbClient.getAgentTraces(creator.id, 50);

  return c.json({
    success: true,
    nextBestAction: orchestratorResult.nextBestAction,
    learning: learningInsight,
    traces,
  });
});

const agentFields = 'id, name, kind, focus, channel, report, last_run';

agentsRoutes.get('/saved', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT ${agentFields} FROM saved_agents WHERE creator_id=? ORDER BY name`)
    .bind(c.get('creator').id)
    .all<SavedAgent>();
  return c.json({ agents: rows.results });
});

agentsRoutes.post('/saved', async (c) => {
  const parsed = agentConfig.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { name, kind, focus, channel } = parsed.data;
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO saved_agents(id,creator_id,name,kind,focus,channel) VALUES (?,?,?,?,?,?)')
    .bind(id, c.get('creator').id, name, kind, focus, channel)
    .run();
  return c.json({ agent: { id, name, kind, focus, channel, report: null, last_run: null } }, 201);
});

agentsRoutes.delete('/saved/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM saved_agents WHERE creator_id=? AND id=?')
    .bind(c.get('creator').id, c.req.param('id'))
    .run();
  return c.json({ success: true });
});

agentsRoutes.post('/saved/:id/run', async (c) => {
  const creator = c.get('creator');
  const agent = await c.env.DB.prepare(`SELECT ${agentFields} FROM saved_agents WHERE creator_id=? AND id=?`)
    .bind(creator.id, c.req.param('id'))
    .first<SavedAgent>();
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  try {
    return c.json({ agent: await runSavedAgent(c.env, creator, agent, '') });
  } catch (error) {
    if (error instanceof AgentRunError) return c.json({ error: error.message }, error.status);
    throw error;
  }
});

agentsRoutes.get('/saved/:id/watch', async (c) => {
  const creatorId = c.get('creator').id;
  const agent = await c.env.DB.prepare("SELECT id FROM saved_agents WHERE id=? AND creator_id=? AND kind='competitor'")
    .bind(c.req.param('id'), creatorId).first<{ id: string }>();
  if (!agent) return c.json({ error: 'Watchlist channel not found.' }, 404);
  return c.json({ review: await readWatchReview(c.env.DB, creatorId, agent.id) });
});

agentsRoutes.post('/saved/:id/watch', async (c) => {
  const creatorId = c.get('creator').id;
  const agent = await c.env.DB.prepare("SELECT id,channel FROM saved_agents WHERE id=? AND creator_id=? AND kind='competitor'")
    .bind(c.req.param('id'), creatorId).first<{ id: string; channel: string }>();
  if (!agent) return c.json({ error: 'Watchlist channel not found.' }, 404);
  try {
    return c.json({ review: await updateWatchReview(c.env, creatorId, agent) });
  } catch (error) {
    if (error instanceof WorkspaceResultBusy) return c.json({ error: error.message }, 409);
    return c.json({ error: 'Could not read public uploads right now. Check the YouTube handle and try again.' }, 422);
  }
});
