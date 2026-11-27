import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import type { BioBlock, BioPage } from '../../shared/types';
import { bioIconUrlFromContent } from '../../shared/bio';

export const bioRoutes = new Hono<AppEnv>();

const MAX_ICON_BYTES = 1024 * 1024;
const ICON_TYPES = {
  'image/png': { extension: 'png', matches: (bytes: Uint8Array) => bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' },
  'image/jpeg': { extension: 'jpg', matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/webp': { extension: 'webp', matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
} as const;

function r2KeyForIconUrl(value: string, origin: string): string | null {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    const match = /^\/bio-icons\/([0-9a-f-]{36}\.(?:png|jpg|webp))$/i.exec(url.pathname);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

bioRoutes.post('/icons', async (c) => {
  const creator = c.get('creator');
  const bucket = c.env.BIO_ICONS;
  if (!bucket) return c.json({ error: 'Icon uploads are not available yet' }, 503);
  const contentLength = Number(c.req.header('content-length') || 0);
  if (contentLength > MAX_ICON_BYTES + 32_000) return c.json({ error: 'Choose an image smaller than 1 MB' }, 413);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'Choose a PNG, JPEG, or WebP image' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ error: 'Choose an image file' }, 400);
  if (!file.size || file.size > MAX_ICON_BYTES) return c.json({ error: 'Choose an image smaller than 1 MB' }, 413);

  const kind = ICON_TYPES[file.type as keyof typeof ICON_TYPES];
  if (!kind) return c.json({ error: 'Use a PNG, JPEG, or WebP image' }, 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!kind.matches(bytes)) return c.json({ error: 'The file contents do not match its image type' }, 415);

  const key = `${crypto.randomUUID()}.${kind.extension}`;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { creatorId: creator.id },
  });
  return c.json({ success: true, iconUrl: `/bio-icons/${key}` });
});

bioRoutes.delete('/icons', async (c) => {
  const creator = c.get('creator');
  const bucket = c.env.BIO_ICONS;
  if (!bucket) return c.json({ success: true }, 200);
  const body = (await c.req.json().catch(() => ({}))) as { iconUrl?: unknown };
  if (typeof body.iconUrl !== 'string' || body.iconUrl.length > 2048) return c.json({ error: 'Invalid icon URL' }, 400);
  const key = r2KeyForIconUrl(body.iconUrl, new URL(c.req.url).origin);
  if (!key) return c.json({ error: 'Invalid uploaded icon' }, 400);

  const object = await bucket.head(key);
  if (!object || object.customMetadata?.creatorId !== creator.id) return c.json({ success: true }, 200);
  const saved = await c.env.DB.prepare(
    'SELECT b.content_json FROM bio_blocks b JOIN bio_pages p ON p.id = b.bio_page_id WHERE p.creator_id = ?'
  )
    .bind(creator.id)
    .all<{ content_json: string | null }>();
  const isStillUsed = (saved.results || []).some((block) => {
    const savedUrl = bioIconUrlFromContent(block.content_json);
    return savedUrl ? r2KeyForIconUrl(savedUrl, new URL(c.req.url).origin) === key : false;
  });
  if (!isStillUsed) await bucket.delete(key);
  return c.json({ success: true });
});

// Get bio page and blocks for authenticated creator
bioRoutes.get('/me', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const data = await dbClient.getBioPageWithBlocks(creator.handle);

  return c.json(data);
});

// Update bio page metadata & styling
bioRoutes.put('/page', async (c) => {
  const creator = c.get('creator');

  const { theme, custom_title, custom_bio, accent_color, bg_color, is_published } = await c.req.json();
  const dbClient = new DBClient(c.env.DB);

  const existing = await c.env.DB.prepare('SELECT * FROM bio_pages WHERE creator_id = ?')
    .bind(creator.id)
    .first<BioPage>();

  const updatedPage: BioPage = {
    id: existing?.id || `bio_${creator.id}`,
    creator_id: creator.id,
    handle: creator.handle,
    theme: theme || existing?.theme || 'dna-accent',
    custom_title: custom_title ?? existing?.custom_title,
    custom_bio: custom_bio ?? existing?.custom_bio,
    accent_color: accent_color || existing?.accent_color || '#6366f1',
    bg_color: bg_color || existing?.bg_color || '#0f172a',
    is_published: is_published ?? existing?.is_published ?? 1,
    views_count: existing?.views_count || 0,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await dbClient.saveBioPage(updatedPage);

  // Invalidate edge cache if KV is present
  if (c.env.KV) {
    await c.env.KV.delete(`bio_html:${creator.handle}`);
  }

  return c.json({ success: true, bioPage: updatedPage });
});

// Save all bio blocks (reordering, editing, adding)
bioRoutes.put('/blocks', async (c) => {
  const creator = c.get('creator');

  const { blocks } = await c.req.json<{ blocks: BioBlock[] }>();
  const dbClient = new DBClient(c.env.DB);

  const page = await c.env.DB.prepare('SELECT id FROM bio_pages WHERE creator_id = ?')
    .bind(creator.id)
    .first<{ id: string }>();

  if (!page) {
    return c.json({ error: 'Bio page not found' }, 404);
  }

  const previous = await c.env.DB.prepare('SELECT content_json FROM bio_blocks WHERE bio_page_id = ?')
    .bind(page.id)
    .all<{ content_json: string | null }>();
  const previousIcons = (previous.results || [])
    .map((block) => bioIconUrlFromContent(block.content_json))
    .filter((url): url is string => !!url);

  await dbClient.saveBioBlocks(page.id, blocks || []);

  if (c.env.BIO_ICONS && previousIcons.length) {
    const nextIcons = new Set((blocks || []).map((block) => block.icon_url).filter((url): url is string => !!url));
    const origin = new URL(c.req.url).origin;
    const staleKeys = [...new Set(previousIcons.filter((url) => !nextIcons.has(url))) ]
      .map((url) => r2KeyForIconUrl(url, origin))
      .filter((key): key is string => !!key);
    for (const key of staleKeys) {
      try {
        const object = await c.env.BIO_ICONS.head(key);
        if (object?.customMetadata?.creatorId === creator.id) await c.env.BIO_ICONS.delete(key);
      } catch {
        // A cleanup failure must not undo saved bio blocks.
      }
    }
  }

  if (c.env.KV) {
    await c.env.KV.delete(`bio_html:${creator.handle}`);
  }

  const refreshed = await dbClient.getBioPageWithBlocks(creator.handle);
  return c.json({ success: true, blocks: refreshed.blocks });
});

// Record block click
bioRoutes.post('/click/:blockId', async (c) => {
  const blockId = c.req.param('blockId');
  const block = await c.env.DB.prepare(
    'SELECT b.*, p.creator_id FROM bio_blocks b JOIN bio_pages p ON b.bio_page_id = p.id WHERE b.id = ?'
  )
    .bind(blockId)
    .first<{ id: string; clicks_count: number; creator_id: string }>();

  if (!block) return c.json({ error: 'Block not found' }, 404);

  const cf = (c.req.raw as Request & { cf?: { country?: string } }).cf || {};
  const country = cf.country || 'India';
  const userAgent = c.req.header('user-agent') || '';
  const device = /mobile/i.test(userAgent) ? 'Mobile' : 'Desktop';
  const referrer = c.req.header('referer') || 'Direct';

  const promise = c.env.DB.batch([
    c.env.DB.prepare('UPDATE bio_blocks SET clicks_count = clicks_count + 1 WHERE id = ?').bind(blockId),
    c.env.DB.prepare(
      `INSERT INTO link_clicks (
          id, bio_block_id, creator_id, country, device, referrer, ip_hash, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `click_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      blockId,
      block.creator_id,
      country,
      device,
      referrer,
      'anon',
      userAgent.slice(0, 100),
      new Date().toISOString()
    ),
  ]);

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(promise);
  } else {
    await promise;
  }

  return c.json({ success: true });
});
