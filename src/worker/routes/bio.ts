import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import type { BioBlock, BioPage } from '../../shared/types';

export const bioRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
  };
}>();

// Get bio page and blocks for authenticated creator
bioRoutes.get('/me', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const data = await dbClient.getBioPageWithBlocks(creator.handle);

  return c.json(data);
});

// Update bio page metadata & styling
bioRoutes.put('/page', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { theme, custom_title, custom_bio, accent_color, bg_color, is_published } =
    await c.req.json();
  const dbClient = new DBClient(c.env.DB);

  const existing = await c.env.DB
    .prepare('SELECT * FROM bio_pages WHERE creator_id = ?')
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
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { blocks } = await c.req.json<{ blocks: BioBlock[] }>();
  const dbClient = new DBClient(c.env.DB);

  const page = await c.env.DB
    .prepare('SELECT id FROM bio_pages WHERE creator_id = ?')
    .bind(creator.id)
    .first<{ id: string }>();

  if (!page) {
    return c.json({ error: 'Bio page not found' }, 404);
  }

  await dbClient.saveBioBlocks(page.id, blocks || []);

  if (c.env.KV) {
    await c.env.KV.delete(`bio_html:${creator.handle}`);
  }

  const refreshed = await dbClient.getBioPageWithBlocks(creator.handle);
  return c.json({ success: true, blocks: refreshed.blocks });
});

// Record block click
bioRoutes.post('/click/:blockId', async (c) => {
  const blockId = c.req.param('blockId');
  const block = await c.env.DB
    .prepare('SELECT b.*, p.creator_id FROM bio_blocks b JOIN bio_pages p ON b.bio_page_id = p.id WHERE b.id = ?')
    .bind(blockId)
    .first<{ id: string; clicks_count: number; creator_id: string }>();

  if (!block) return c.json({ error: 'Block not found' }, 404);

  const cf = (c.req.raw as any).cf || {};
  const country = cf.country || 'India';
  const userAgent = c.req.header('user-agent') || '';
  const device = /mobile/i.test(userAgent) ? 'Mobile' : 'Desktop';
  const referrer = c.req.header('referer') || 'Direct';

  const promise = c.env.DB.batch([
    c.env.DB
      .prepare('UPDATE bio_blocks SET clicks_count = clicks_count + 1 WHERE id = ?')
      .bind(blockId),
    c.env.DB
      .prepare(
        `INSERT INTO link_clicks (
          id, bio_block_id, creator_id, country, device, referrer, ip_hash, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
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
