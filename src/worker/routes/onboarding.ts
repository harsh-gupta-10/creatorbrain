import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { saveAmazonCredentials, MARKETPLACES, PARTNER_TAG_RE } from '../amazon/credentials';
import { SCRIPT_LANGUAGES } from '../lib/language';
import { AIRouter } from '../ai/router';
import { runStudyStep, stepVideo, stepFetch, STUDY_STEPS, STEP_LABELS, computeStats } from '../agents/definitions/onboardingPipeline';
import { ChannelNotFoundError } from '../content/youtube';
import type { AnalysisJob } from '../../shared/types';

export const onboardingRoutes = new Hono<AppEnv>();

const ProfileSchema = z
  .object({
    niche: z.string().trim().min(2, 'Tell us what your channel is about').max(80),
    language: z.string().trim().max(60).default('English'),
    scriptLanguage: z.enum(SCRIPT_LANGUAGES).default('english'),
    cadence: z.enum(['weekly', 'biweekly', 'monthly', 'irregular']).default('weekly'),
    youtube: z.string().trim().max(200).optional().default(''),
    instagram: z.string().trim().max(60).optional().default(''),
    instagramCaptions: z.array(z.string().trim().max(2200)).max(12).optional().default([]),
    amazon: z
      .object({
        enabled: z.boolean(),
        partnerTag: z.string().trim().max(40).optional().default(''),
        marketplace: z.enum(MARKETPLACES).default('amazon.com'),
      })
      .default({ enabled: false, partnerTag: '', marketplace: 'amazon.com' }),
    otherIncome: z.array(z.string().max(40)).max(8).default([]),
    goals: z.array(z.string().max(40)).max(6).default([]),
  })
  .refine((v) => v.youtube.length > 0 || v.instagramCaptions.filter(Boolean).length > 0, {
    message: 'Add your YouTube channel or paste at least one Instagram caption so we have something to study',
  })
  .refine((v) => !v.amazon.enabled || PARTNER_TAG_RE.test(v.amazon.partnerTag), {
    message: 'Enter your Amazon Associates tracking ID, like yourname-20',
  });

onboardingRoutes.post('/profile', async (c) => {
  const creator = c.get('creator');

  const parsed = ProfileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const p = parsed.data;

  const db = c.env.DB;
  const ts = new Date().toISOString();
  const platform = p.youtube && (p.instagram || p.instagramCaptions.length) ? 'both' : p.youtube ? 'youtube' : 'instagram';
  // The tracking ID is stored encrypted in credentials_encrypted, not in this JSON
  const monetization = { amazon: p.amazon.enabled, marketplace: p.amazon.marketplace, other: p.otherIncome };

  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE creators SET niche = ?, content_language = ?, script_language = ?, upload_cadence = ?, youtube_input = ?, instagram_handle = ?,
           platform = ?, goals_json = ?, monetization_json = ?, onboarding_status = 'ready', updated_at = ?
         WHERE id = ?`
      )
      .bind(p.niche, p.language, p.scriptLanguage, p.cadence, p.youtube || null, p.instagram.replace(/^@/, '') || null, platform, JSON.stringify(p.goals), JSON.stringify(monetization), ts, creator.id),
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

  await db.batch(stmts);
  if (p.amazon.enabled) {
    await saveAmazonCredentials(db, c.env, creator.id, { partnerTag: p.amazon.partnerTag, marketplace: p.amazon.marketplace });
  }
  return c.json({ success: true });
});

// Start a study job; the client then calls /study/step until it completes.
// A study already in progress is returned instead of starting a second one.
onboardingRoutes.post('/study/start', async (c) => {
  const creator = c.get('creator');
  const running = await c.env.DB.prepare(
    "SELECT id FROM analysis_jobs WHERE creator_id = ? AND status = 'running' AND updated_at > ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(creator.id, new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .first<{ id: string }>();
  if (running) return c.json({ success: true, jobId: running.id, steps: STUDY_STEPS.map((s) => ({ id: s, label: STEP_LABELS[s] })) });

  const jobId = `job_${crypto.randomUUID()}`;
  const ts = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO analysis_jobs (id, creator_id, channel_url, status, current_step, progress_percent, created_at, updated_at)
     VALUES (?, ?, ?, 'running', 'fetch', 0, ?, ?)`
  )
    .bind(jobId, creator.id, creator.youtube_input || creator.instagram_handle || '', ts, ts)
    .run();

  return c.json({ success: true, jobId, steps: STUDY_STEPS.map((s) => ({ id: s, label: STEP_LABELS[s] })) });
});

onboardingRoutes.post('/study/step', async (c) => {
  const creator = c.get('creator');

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

  // Claim the step so two open tabs never run the same step twice
  const claimedAt = new Date().toISOString();
  const claim = await db
    .prepare('UPDATE analysis_jobs SET updated_at = ? WHERE id = ? AND updated_at = ? AND status = ?')
    .bind(claimedAt, jobId, job.updated_at, 'running')
    .run();
  if (!claim.meta.changes) return c.json({ job, busy: true });

  try {
    const router = new AIRouter(c.env);
    const results = JSON.parse(job.result_json || '{}');
    let next: string | undefined = STUDY_STEPS[index + 1];

    if (step === 'video') {
      // One video per request; stay on this step while videos remain within this run's budget
      const progress = results.videoProgress || { done: 0, failed: 0, last: '' };
      const r = await stepVideo(db, c.env, router, creator.id, progress.done);
      if (r.analyzedTitle) {
        progress.done += 1;
        if (r.failed) progress.failed += 1;
        progress.last = r.analyzedTitle;
      }
      results.videoProgress = progress;
      results.video = progress.done
        ? `Studied ${progress.done} video${progress.done === 1 ? '' : 's'} in depth${progress.failed ? `, ${progress.failed} could not be read` : ''}`
        : 'No new videos to study';
      if (r.more) next = 'video';
    } else if (step === 'fetch') {
      const f = await stepFetch(db, c.env, creator.id);
      results.fetch = f.summary;
      results.videoProgress = { done: 0, failed: 0, last: '', total: f.toStudy };
      if (f.channelError) results.channelError = f.channelError;
      if (!f.toStudy) next = 'synthesize';
    } else {
      results[step] = await runStudyStep({ step, creatorId: creator.id, db, env: c.env, router });
    }

    const stepIndex = next ? STUDY_STEPS.indexOf(next as (typeof STUDY_STEPS)[number]) : STUDY_STEPS.length;
    await db
      .prepare('UPDATE analysis_jobs SET status = ?, current_step = ?, progress_percent = ?, result_json = ?, updated_at = ? WHERE id = ?')
      .bind(next ? 'running' : 'completed', next || 'done', Math.round((stepIndex / STUDY_STEPS.length) * 100), JSON.stringify(results), new Date().toISOString(), jobId)
      .run();
  } catch (err: any) {
    console.error('[Study step failed]', step, err);
    const results = JSON.parse(job.result_json || '{}');
    if (err instanceof ChannelNotFoundError) results.errorCode = 'channel_not_found';
    await db
      .prepare("UPDATE analysis_jobs SET status = 'failed', error_message = ?, result_json = ?, updated_at = ? WHERE id = ?")
      .bind(String(err?.message || 'Study failed'), JSON.stringify(results), new Date().toISOString(), jobId)
      .run();
  }

  const updated = await db.prepare('SELECT * FROM analysis_jobs WHERE id = ?').bind(jobId).first<AnalysisJob>();
  return c.json({ job: updated });
});

// The latest study from the last day, so the app can resume or report it after a reload
onboardingRoutes.get('/study/active', async (c) => {
  const creator = c.get('creator');
  const job = await c.env.DB.prepare(
    'SELECT * FROM analysis_jobs WHERE creator_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 1'
  )
    .bind(creator.id, new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .first<AnalysisJob>();
  return c.json({ job: job || null });
});

const ChannelSchema = z.object({
  youtube: z.string().trim().min(2, 'Paste your channel link, like https://www.youtube.com/@yourhandle').max(200),
});

// Fix the YouTube link after a study could not find the channel
onboardingRoutes.put('/channel', async (c) => {
  const creator = c.get('creator');
  const parsed = ChannelSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the link' }, 400);
  await c.env.DB.prepare(
    "UPDATE creators SET youtube_input = ?, youtube_channel_id = NULL, platform = CASE WHEN instagram_handle IS NOT NULL THEN 'both' ELSE 'youtube' END, updated_at = ? WHERE id = ?"
  )
    .bind(parsed.data.youtube, new Date().toISOString(), creator.id)
    .run();
  return c.json({ success: true });
});

onboardingRoutes.get('/job/:id', async (c) => {
  const creator = c.get('creator');
  const job = await c.env.DB.prepare('SELECT * FROM analysis_jobs WHERE id = ? AND creator_id = ?')
    .bind(c.req.param('id'), creator.id)
    .first<AnalysisJob>();
  if (!job) return c.json({ error: 'Study not found' }, 404);
  return c.json({ job });
});

// Recent studied content and simple stats for the dashboard
onboardingRoutes.get('/content', async (c) => {
  const creator = c.get('creator');
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
    lastStudiedAt: creator.last_studied_at || null,
  });
});
