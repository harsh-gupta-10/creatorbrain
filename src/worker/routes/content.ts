import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { AIRouter } from '../ai/router';
import { analyzeContentItem, pendingItems } from '../content/analyze';

/**
 * The creator's content library: every studied video or post with its stored
 * transcript, thumbnail notes and breakdown.
 */
export const contentRoutes = new Hono<AppEnv>();

const LIST_COLUMNS = `id, platform, external_id, title, url, thumbnail_url, views, likes, comments, duration_seconds,
  published_at, analysis_status, analyzed_by, analyzed_at, transcript_source,
  json_extract(analysis_json, '$.hook.type') AS hook_type,
  json_extract(analysis_json, '$.packaging_score') AS packaging_score,
  json_extract(analysis_json, '$.topics') AS topics_json`;

contentRoutes.get('/', async (c) => {
  const creator = c.get('creator');
  const status = c.req.query('status');
  const platform = c.req.query('platform');
  const where = ['creator_id = ?'];
  const binds: unknown[] = [creator.id];
  if (status && ['pending', 'done', 'failed'].includes(status)) {
    where.push('analysis_status = ?');
    binds.push(status);
  }
  if (platform && ['youtube', 'instagram'].includes(platform)) {
    where.push('platform = ?');
    binds.push(platform);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT ${LIST_COLUMNS} FROM content_items WHERE ${where.join(' AND ')} ORDER BY published_at DESC LIMIT 100`
  )
    .bind(...binds)
    .all();
  const counts = await c.env.DB.prepare(
    `SELECT analysis_status AS status, COUNT(*) AS n FROM content_items WHERE creator_id = ? GROUP BY analysis_status`
  )
    .bind(creator.id)
    .all<{ status: string; n: number }>();
  return c.json({
    items: results || [],
    counts: Object.fromEntries((counts.results || []).map((r) => [r.status || 'pending', r.n])),
  });
});

contentRoutes.get('/:id', async (c) => {
  const creator = c.get('creator');
  const row = await c.env.DB.prepare('SELECT * FROM content_items WHERE id = ? AND creator_id = ?')
    .bind(c.req.param('id'), creator.id)
    .first<Record<string, unknown>>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const parse = (v: string | null, fallback: unknown) => {
    try {
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  };
  return c.json({
    item: {
      ...row,
      transcript: parse(typeof row.transcript === 'string' ? row.transcript : null, []),
      tags: parse(typeof row.tags_json === 'string' ? row.tags_json : null, []),
      analysis: parse(typeof row.analysis_json === 'string' ? row.analysis_json : null, null),
      thumbnail_analysis: parse(
        typeof row.thumbnail_analysis_json === 'string' ? row.thumbnail_analysis_json : null,
        null
      ),
      transcript_json: undefined,
      analysis_json: undefined,
      thumbnail_analysis_json: undefined,
      tags_json: undefined,
    },
  });
});

/** Deep-studies the next waiting item (or a specific one with ?id=), one per request */
contentRoutes.post('/analyze-next', async (c) => {
  const creator = c.get('creator');
  const requested = c.req.query('id');
  let id: string | undefined;
  if (requested) {
    const own = await c.env.DB.prepare('SELECT id FROM content_items WHERE id = ? AND creator_id = ?')
      .bind(requested, creator.id)
      .first<{ id: string }>();
    id = own?.id;
  } else {
    [id] = await pendingItems(c.env.DB, creator.id, 1);
  }
  if (!id) return c.json({ done: true, remaining: 0 });

  const result = await analyzeContentItem(c.env.DB, c.env, new AIRouter(c.env), id);
  const remaining = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM content_items WHERE creator_id = ? AND (analysis_status IS NULL OR analysis_status = 'pending')"
  )
    .bind(creator.id)
    .first<{ n: number }>();
  return c.json({ done: false, id, ...result, remaining: remaining?.n || 0 });
});
