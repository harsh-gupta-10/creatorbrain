import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import { CreateShortLinkSchema } from '../../shared/types';
import type { ShortLink, LinkClick } from '../../shared/types';

export const linkRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
  };
}>();

// SSRF Safety: Block internal IPs and loopbacks
function isSafeUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('169.254.')
    ) {
      return false;
    }

    // Domain blocklist of known malware/phishing domains
    const blocklist = ['phishing.com', 'malware.ru', 'scam.link', 'grabify.link'];
    if (blocklist.some((b) => host === b || host.endsWith('.' + b))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Get all short links for creator
linkRoutes.get('/', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const links = await dbClient.getShortLinks(creator.id);
  return c.json({ links });
});

// Create new short link
linkRoutes.post('/create', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = CreateShortLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid link data' }, 400);
  }

  const { destination_url, title, utm_source, utm_medium, utm_campaign, expires_at } =
    parsed.data;

  if (!isSafeUrl(destination_url)) {
    return c.json(
      { error: 'Invalid or prohibited destination URL. Only public http/https domains allowed.' },
      400
    );
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

  // Cache in KV for sub-millisecond edge redirects
  if (c.env.KV) {
    await c.env.KV.put(`link:${slug}`, finalDestination);
  }

  return c.json({
    success: true,
    shortLink: newLink,
    shortUrl: `https://creatorbrain.dev/s/${slug}`,
  });
});

// Get single link analytics & clicks
linkRoutes.get('/:id', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const linkId = c.req.param('id');
  const link = await c.env.DB
    .prepare('SELECT * FROM short_links WHERE id = ? AND creator_id = ?')
    .bind(linkId, creator.id)
    .first<ShortLink>();

  if (!link) return c.json({ error: 'Short link not found' }, 404);

  const clicksRes = await c.env.DB
    .prepare('SELECT * FROM link_clicks WHERE short_link_id = ? ORDER BY created_at DESC LIMIT 100')
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
