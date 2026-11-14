import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import { getSession } from './auth';
import { AIRouter } from '../ai/router';
import { runStudyStep, STUDY_STEPS, STEP_LABELS, computeStats } from '../agents/definitions/onboardingPipeline';
import type { AnalysisJob } from '../../shared/types';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  AI?: any;
};

export const onboardingRoutes = new Hono<{ Bindings: Bindings }>();

const ProfileSchema = z
  .object({
    niche: z.string().trim().min(2, 'Tell us what your channel is about').max(80),
    language: z.string().trim().max(60).default('English'),
    cadence: z.enum(['weekly', 'biweekly', 'monthly', 'irregular']).default('weekly'),
    youtube: z.string().trim().max(200).optional().default(''),
    instagram: z.string().trim().max(60).optional().default(''),
    instagramCaptions: z.array(z.string().trim().max(2200)).max(12).optional().default([]),
    amazon: z
      .object({
        enabled: z.boolean(),
        partnerTag: z.string().trim().max(40).optional().default(''),
        marketplace: z.string().trim().max(30).optional().default('amazon.com'),
      })
      .default({ enabled: false, partnerTag: '', marketplace: 'amazon.com' }),
    otherIncome: z.array(z.string().max(40)).max(8).default([]),
    goals: z.array(z.string().max(40)).max(6).default([]),
  })
  .refine((v) => v.youtube.length > 0 || v.instagramCaptions.filter(Boolean).length > 0, {
    message: 'Add your YouTube channel or paste at least one Instagram caption so we have something to study',
  })
  .refine((v) => !v.amazon.enabled || /^[\w-]{3,40}$/.test(v.amazon.partnerTag), {
    message: 'Enter your Amazon Associates tracking ID, like yourname-20',
  });

async function requireCreator(c: any) {
  const session = await getSession(c.env.DB, getCookie(c, 'cb_session'));
  return session;
}

onboardingRoutes.post('/profile', async (c) => {
  const { creator, isSample } = await requireCreator(c);
  if (!creator) return c.json({ error: 'Sign in to continue' }, 401);
  if (isSample) return c.json({ error: 'The sample workspace is read-only' }, 403);

  const parsed = ProfileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const p = parsed.data;

  const db = c.env.DB;
  const ts = new Date().toISOString();
  const platform = p.youtube && (p.instagram || p.instagramCaptions.length) ? 'both' : p.youtube ? 'youtube' : 'instagram';
  const monetization = {
    amazon: p.amazon.enabled,
    partnerTag: p.amazon.enabled ? p.amazon.partnerTag : '',
    marketplace: p.amazon.marketplace,
    other: p.otherIncome,
  };

  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE creators SET niche = ?, content_language = ?, upload_cadence = ?, youtube_input = ?, instagram_handle = ?,
           platform = ?, goals_json = ?, monetization_json = ?, onboarding_status = 'study', updated_at = ?
         WHERE id = ?`
      )
      .bind(p.niche, p.language, p.cadence, p.youtube || null, p.instagram.replace(/^@/, '') || null, platform, JSON.stringify(p.goals), JSON.stringify(monetization), ts, creator.id),
    db.prepare("DELETE FROM content_items WHERE creator_id = ? AND platform = 'instagram'").bind(creator.id),
    ...p.instagramCaptions
      .filter(Boolean)
      .map((caption, i) =>
        db
          .prepare(
            `INSERT INTO content_items (id, creator_id, platform, external_id, title, description, views, likes, published_at, created_at, updated_at)
             VALUES (?, ?, 'instagram', ?, ?, ?, 0, 0, ?, ?, ?)`
          )
          .bind(`ci_${crypto.randomUUID().slice(0, 12)}`, creator.id, `caption_${i + 1}`, caption.split('\n')[0].slice(0, 120), caption, new Date(Date.now() - i * 86400000).toISOString(), ts, ts)
      ),
  ];

  if (p.amazon.enabled) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO credentials_encrypted (id, creator_id, amazon_partner_tag, amazon_marketplace, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (creator_id) DO UPDATE SET amazon_partner_tag = excluded.amazon_partner_tag,
             amazon_marketplace = excluded.amazon_marketplace, updated_at = excluded.updated_at`
        )
        .bind(`cred_${creator.id}`, creator.id, p.amazon.partnerTag, p.amazon.marketplace, ts, ts)
    );
  }

  await db.batch(stmts);
  return c.json({ success: true });
});

// Start a study job; the client then calls /study/step until it completes
onboardingRoutes.post('/study/start', async (c) => {
  const { creator, isSample } = await requireCreator(c);
  if (!creator) return c.json({ error: 'Sign in to continue' }, 401);
  if (isSample) return c.json({ error: 'The sample workspace is read-only' }, 403);

  const jobId = `job_${crypto.randomUUID()}`;
  const ts = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO analysis_jobs (id, creator_id, channel_url, status, current_step, progress_percent, created_at, updated_at)
     VALUES (?, ?, ?, 'running', 'fetch', 0, ?, ?)`
  )
    .bind(jobId, creator.id, (creator as any).youtube_input || (creator as any).instagram_handle || '', ts, ts)
    .run();

  return c.json({ success: true, jobId, steps: STUDY_STEPS.map((s) => ({ id: s, label: STEP_LABELS[s] })) });
});

onboardingRoutes.post('/study/step', async (c) => {
  const { creator } = await requireCreator(c);
  if (!creator) return c.json({ error: 'Sign in to continue' }, 401);

  const { jobId } = await c.req.json().catch(() => ({ jobId: '' }));
  const db = c.env.DB;
  const job = await db
    .prepare('SELECT * FROM analysis_jobs WHERE id = ? AND creator_id = ?')
    .bind(jobId, creator.id)
    .first<AnalysisJob>();
  if (!job) return c.json({ error: 'Study not found' }, 404);
  if (job.status !== 'running') return c.json({ job });

  const step = job.current_step as (typeof STUDY_STEPS)[number];
  const index = STUDY_STEPS.indexOf(step);
  if (index < 0) return c.json({ error: 'Study is in an unknown state' }, 409);

  try {
    const summary = await runStudyStep({ step, creatorId: creator.id, db, router: new AIRouter(c.env) });
    const next = STUDY_STEPS[index + 1];
    const results = JSON.parse(job.result_json || '{}');
    results[step] = summary;
    await db
      .prepare('UPDATE analysis_jobs SET status = ?, current_step = ?, progress_percent = ?, result_json = ?, updated_at = ? WHERE id = ?')
      .bind(next ? 'running' : 'completed', next || 'done', Math.round(((index + 1) / STUDY_STEPS.length) * 100), JSON.stringify(results), new Date().toISOString(), jobId)
      .run();
  } catch (err: any) {
    console.error('[Study step failed]', step, err);
    await db
      .prepare("UPDATE analysis_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
      .bind(String(err?.message || 'Study failed'), new Date().toISOString(), jobId)
      .run();
  }

  const updated = await db.prepare('SELECT * FROM analysis_jobs WHERE id = ?').bind(jobId).first<AnalysisJob>();
  return c.json({ job: updated });
});

onboardingRoutes.get('/job/:id', async (c) => {
  const { creator } = await requireCreator(c);
  if (!creator) return c.json({ error: 'Sign in to continue' }, 401);
  const job = await c.env.DB.prepare('SELECT * FROM analysis_jobs WHERE id = ? AND creator_id = ?')
    .bind(c.req.param('id'), creator.id)
    .first<AnalysisJob>();
  if (!job) return c.json({ error: 'Study not found' }, 404);
  return c.json({ job });
});

// Recent studied content and simple stats for the dashboard
onboardingRoutes.get('/content', async (c) => {
  const { creator } = await requireCreator(c);
  if (!creator) return c.json({ error: 'Sign in to continue' }, 401);
  const { results } = await c.env.DB.prepare(
    `SELECT id, platform, external_id, title, description, url, thumbnail_url, views, likes, published_at
     FROM content_items WHERE creator_id = ? ORDER BY published_at DESC LIMIT 15`
  )
    .bind(creator.id)
    .all<any>();
  const items = results || [];
  const stats = computeStats(items);
  return c.json({
    items,
    stats: {
      count: stats.count,
      medianViews: stats.medianViews,
      avgTitleLength: stats.avgTitleLength,
      uploadsPerMonth: stats.uploadsPerMonth,
      topWords: stats.topWords,
    },
    lastStudiedAt: (creator as any).last_studied_at || null,
  });
});
