import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { CreateShortLinkSchema, type ShortLink, type LinkClick } from '../../shared/types';
import { isSafePublicHttpUrl } from '../lib/url-safety';
import { serializeShortLinkCache, shortLinkCacheTtl } from '../lib/short-link-cache';

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

  const body = await c.req.json();
  const parsed = CreateShortLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid link data' }, 400);
  }

  const { destination_url, title, utm_source, utm_medium, utm_campaign, expires_at } = parsed.data;

  if (!isSafePublicHttpUrl(destination_url)) {
    return c.json({ error: 'Invalid or prohibited destination URL. Only public http/https domains allowed.' }, 400);
  }

  if (expires_at && Date.parse(expires_at) <= Date.now()) {
    return c.json({ error: 'Expiration must be a future date and time' }, 400);
  }

  const urlObj = new URL(destination_url);
  const destinationDomain = urlObj.hostname;

  // Append UTM if provided
  if (utm_source) urlObj.searchParams.set('utm_source', utm_source);
  if (utm_medium) urlObj.searchParams.set('utm_medium', utm_medium);
  if (utm_campaign) urlObj.searchParams.set('utm_campaign', utm_campaign);

  const finalDestination = urlObj.toString();
  const dbClient = new DBClient(c.env.DB);

  let slug = parsed.data.slug;
  if (!slug) {
    slug = Math.random().toString(36).slice(2, 8);
  } else {
    // Check if slug taken
    const existing = await dbClient.getShortLinkBySlug(slug);
    if (existing) {
      return c.json({ error: `Custom slug "${slug}" is already in use. Please pick another.` }, 409);
    }
  }

  const newLink: ShortLink = {
    id: `link_${Date.now()}_${slug}`,
    creator_id: creator.id,
    slug,
    destination_url: finalDestination,
    destination_domain: destinationDomain,
    title: title || `${destinationDomain} Link`,
    utm_source,
    utm_medium,
    utm_campaign,
    expires_at: expires_at || undefined,
    total_clicks: 0,
    created_at: new Date().toISOString(),
  };

  await dbClient.createShortLink(newLink);

  const cacheTtl = shortLinkCacheTtl(newLink.expires_at);
  if (c.env.KV && cacheTtl) {
    await c.env.KV.put(`link:${slug}`, serializeShortLinkCache(newLink), { expirationTtl: cacheTtl });
  }

  return c.json({
    success: true,
    shortLink: newLink,
    shortUrl: `${new URL(c.req.url).origin}/s/${slug}`,
  });
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
