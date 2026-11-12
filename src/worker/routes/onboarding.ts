import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { AIRouter } from '../ai/router';
import { runCreatorDNAPipeline } from '../agents/definitions/onboardingPipeline';
import { OnboardingSchema } from '../../shared/types';
import type { AnalysisJob } from '../../shared/types';

export const onboardingRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI?: any;
  };
}>();

onboardingRoutes.post('/start', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);

  if (!creator) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
  }

  const { platform, urlOrHandle } = parsed.data;
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  // Create analysis job in D1
  await c.env.DB
    .prepare(
      `INSERT INTO analysis_jobs (
        id, creator_id, channel_url, status, current_step, progress_percent, created_at, updated_at
      ) VALUES (?, ?, ?, 'running', 'Channel Scout: Initializing YouTube channel history...', 5, ?, ?)`
    )
    .bind(jobId, creator.id, urlOrHandle, now, now)
    .run();

  const router = new AIRouter(c.env);

  // Run pipeline
  const promise = runCreatorDNAPipeline({
    creatorId: creator.id,
    channelUrlOrHandle: urlOrHandle,
    platform,
    router,
    db: c.env.DB,
    onProgress: async (step, percent) => {
      await c.env.DB
        .prepare('UPDATE analysis_jobs SET current_step = ?, progress_percent = ?, updated_at = ? WHERE id = ?')
        .bind(step, percent, new Date().toISOString(), jobId)
        .run();
    },
  })
    .then(async (result) => {
      await c.env.DB
        .prepare(
          'UPDATE analysis_jobs SET status = "completed", progress_percent = 100, current_step = "Analysis complete!", result_json = ?, updated_at = ? WHERE id = ?'
        )
        .bind(JSON.stringify(result), new Date().toISOString(), jobId)
        .run();
    })
    .catch(async (err) => {
      console.error('[Onboarding Pipeline Error]:', err);
      await c.env.DB
        .prepare(
          'UPDATE analysis_jobs SET status = "failed", error_message = ?, updated_at = ? WHERE id = ?'
        )
        .bind(err.message, new Date().toISOString(), jobId)
        .run();
    });

  // Attach to executionCtx if available
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(promise);
  } else {
    await promise;
  }

  return c.json({
    success: true,
    jobId,
    message: 'Analysis job launched successfully',
  });
});

onboardingRoutes.get('/job/:id', async (c) => {
  const jobId = c.req.param('id');
  const job = await c.env.DB
    .prepare('SELECT * FROM analysis_jobs WHERE id = ?')
    .bind(jobId)
    .first<AnalysisJob>();

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json({ job });
});

onboardingRoutes.post('/instagram-lite', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);

  if (!creator) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { handle } = await c.req.json();
  const router = new AIRouter(c.env);

  const result = await runCreatorDNAPipeline({
    creatorId: creator.id,
    channelUrlOrHandle: handle,
    platform: 'instagram',
    router,
    db: c.env.DB,
  });

  return c.json({ success: true, result });
});
