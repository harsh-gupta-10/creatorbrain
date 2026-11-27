import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import {
  deliverStudioEvent,
  ExperimentAssignmentChanged,
  ExperimentEventPending,
  verifyStudioTicket,
} from '../lib/studio-experiment';
import {
  applyExperimentApproval,
  experimentReadout,
  FlagOperatorError,
  mayManageExperiment,
  proposeExperimentChange,
} from '../lib/flagsmith-operator';
import { WorkspaceResultBusy } from '../lib/workspace-results';

export const experimentsRoutes = new Hono<AppEnv>();

experimentsRoutes.post('/studio-event', async (c) => {
  const input = z
    .object({ ticket: z.string().max(1600), event: z.enum(['seen', 'sent']) })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Invalid experiment event.' }, 400);
  const assignment = await verifyStudioTicket(c.env, c.get('creator').id, input.data.ticket);
  if (!assignment) return c.json({ error: 'Experiment assignment expired or invalid.' }, 400);
  try {
    await deliverStudioEvent(c.env, assignment, input.data.event);
    return c.json({ accepted: true });
  } catch (error) {
    if (error instanceof ExperimentAssignmentChanged) return c.json({ error: 'Experiment assignment changed.' }, 400);
    if (error instanceof ExperimentEventPending) return c.json({ error: 'Experiment event is pending.' }, 409);
    return c.json({ error: 'Experiment event could not be delivered.' }, 503);
  }
});

experimentsRoutes.get('/access', (c) =>
  c.json({ allowed: mayManageExperiment(c.env, c.get('creator').id, c.get('isSample')) })
);

experimentsRoutes.get('/operator', async (c) => {
  try {
    const { summary } = await experimentReadout(c.env, c.get('creator').id, c.get('isSample'));
    return c.json({ summary });
  } catch (error) {
    if (error instanceof FlagOperatorError) return c.json({ error: error.message }, error.statusCode);
    return c.json({ error: 'Flagsmith is unavailable. Try again.' }, 503);
  }
});

experimentsRoutes.post('/operator/proposal', async (c) => {
  const input = z.object({ prompt: z.string().trim().min(1).max(800) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Enter a request about the experiment.' }, 400);
  try {
    return c.json(await proposeExperimentChange(c.env, c.get('creator').id, c.get('isSample'), input.data.prompt));
  } catch (error) {
    if (error instanceof FlagOperatorError) return c.json({ error: error.message }, error.statusCode);
    if (error instanceof WorkspaceResultBusy) return c.json({ error: error.message }, 409);
    return c.json({ error: 'Could not prepare the experiment change.' }, 503);
  }
});

experimentsRoutes.post('/operator/approve', async (c) => {
  const input = z.object({ approvalId: z.uuid() }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Select a valid change preview.' }, 400);
  try {
    return c.json(await applyExperimentApproval(c.env, c.get('creator').id, c.get('isSample'), input.data.approvalId));
  } catch (error) {
    if (error instanceof FlagOperatorError) return c.json({ error: error.message }, error.statusCode);
    return c.json({ error: 'Could not confirm the change. Refresh the Flagsmith state before retrying.' }, 503);
  }
});
