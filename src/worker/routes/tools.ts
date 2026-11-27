import { WorkspaceResultBusy } from '../lib/workspace-results';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ToolGeneratorSchema } from '../../shared/types';
import { runQuickTool } from '../agents/quick-tools';

export const toolsRoutes = new Hono<AppEnv>();

toolsRoutes.post('/generate', async (c) => {
  const parsed = ToolGeneratorSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, 400);
  const { toolType, topic, platform } = parsed.data;
  try {
    const output = await runQuickTool(c.env, c.get('creator'), parsed.data);
    return c.json({ toolType, topic, platform, output });
  } catch (error) {
    if (error instanceof WorkspaceResultBusy) return c.json({ error: error.message }, 409);
    return c.json({ error: 'Quick Tools could not generate a result. Check the AI provider and daily budget in Settings.' }, 503);
  }
});
