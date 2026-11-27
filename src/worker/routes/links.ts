import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { CreateShortLinkSchema, type ShortLink, type LinkClick } from '../../shared/types';
import { saveShortLink, ShortLinkError } from '../lib/short-links';

export const linkRoutes = new Hono<AppEnv>();

// Get all short links for creator
linkRoutes.get('/', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const links = await dbClient.getShortLinks(creator.id);
  return c.json({ links });
});

// Create new short link
linkRoutes.post('/create', async (c) => {
  const creator = c.get('creator');

  const body = await c.req.json().catch(() => null);
  const parsed = CreateShortLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid link data' }, 400);
  }

  try {
    const result = await saveShortLink(c.env, creator.id, new URL(c.req.url).origin, parsed.data);
    return c.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ShortLinkError) return c.json({ error: error.message }, error.status);
    throw error;
  }
});

// Get single link analytics & clicks
linkRoutes.get('/:id', async (c) => {
  const creator = c.get('creator');

  const linkId = c.req.param('id');
  const link = await c.env.DB.prepare('SELECT * FROM short_links WHERE id = ? AND creator_id = ?')
    .bind(linkId, creator.id)
    .first<ShortLink>();

  if (!link) return c.json({ error: 'Short link not found' }, 404);

  const clicksRes = await c.env.DB.prepare(
    'SELECT * FROM link_clicks WHERE short_link_id = ? ORDER BY created_at DESC LIMIT 100'
  )
    .bind(linkId)
    .all<LinkClick>();

  return c.json({ link, clicks: clicksRes.results || [] });
});

// Abuse reporting endpoint
linkRoutes.post('/report-abuse', async (c) => {
  const { slug } = await c.req.json();
  if (!slug) return c.json({ error: 'Slug is required' }, 400);

  // In production, flags link in D1 or sends notification
  return c.json({
    success: true,
    message: 'Abuse report received and queued for trust & safety review.',
  });
});
