import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';

import { runOrchestrator, runMemoryCurator } from '../agents/definitions/tutorAndCurriculum';

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
  await c.env.DB
    .prepare(
      `INSERT INTO agent_traces (
        id, creator_id, agent_name, task_description, step_number, total_steps,
        tool_called, tool_input, tool_result, output_summary, status, created_at
      ) VALUES (?, ?, 'Orchestrator', 'Evaluate channel growth bottlenecks & update next best action', 1, 1, 'evaluateChannelHealth', ?, ?, ?, 'success', ?)`
    )
    .bind(
      `trace_run_${Date.now()}`,
      creator.id,
      JSON.stringify({ creatorId: creator.id }),
      JSON.stringify(orchestratorResult),
      `Orchestrator determined next best action: "${orchestratorResult.nextBestAction}". Memory Curator recorded new channel learning.`,
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
