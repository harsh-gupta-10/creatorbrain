import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { DBClient } from '../db/queries';
import type { Creator } from '../../shared/types';

export const authRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
  };
  Variables: {
    creator: Creator | null;
  };
}>();

const DEMO_CREATOR_ID = 'creator_demo_tech_kabir';

// Web Crypto PBKDF2 hash helper
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('creatorbrain_auth_salt_2026'),
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Middleware helper to get creator from session cookie
export async function getSessionCreator(
  db: D1Database,
  sessionId?: string
): Promise<Creator | null> {
  const dbClient = new DBClient(db);

  if (!sessionId) {
    // If no session, return demo creator by default for instant friction-free exploration
    return await dbClient.getCreator(DEMO_CREATOR_ID);
  }

  const session = await db
    .prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, new Date().toISOString())
    .first<{ creator_id: string }>();

  if (!session) {
    return await dbClient.getCreator(DEMO_CREATOR_ID);
  }

  return await dbClient.getCreator(session.creator_id);
}

// Routes
authRoutes.get('/me', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  return c.json({
    authenticated: !!creator,
    isDemo: creator?.id === DEMO_CREATOR_ID,
    creator,
  });
});

authRoutes.post('/demo', async (c) => {
  const sessionId = `sess_demo_${Date.now()}`;
  const expires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  await c.env.DB
    .prepare('INSERT OR REPLACE INTO sessions (id, creator_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, DEMO_CREATOR_ID, expires, new Date().toISOString())
    .run();

  setCookie(c, 'cb_session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 86400,
  });

  const dbClient = new DBClient(c.env.DB);
  const creator = await dbClient.getCreator(DEMO_CREATOR_ID);

  return c.json({ success: true, isDemo: true, creator });
});

authRoutes.post('/signup', async (c) => {
  const { email, password, name, handle, channelTitle, channelUrl, platform } = await c.req.json();

  if (!email || !password || !name || !handle) {
    return c.json({ error: 'Missing required signup fields' }, 400);
  }

  const dbClient = new DBClient(c.env.DB);
  const existing = await dbClient.getCreatorByHandle(handle);
  if (existing) {
    return c.json({ error: 'Handle is already taken' }, 409);
  }

  const id = `creator_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await c.env.DB
    .prepare(
      `INSERT INTO creators (
        id, email, password_hash, name, handle, channel_title, channel_url,
        platform, subscribers, avatar_url, bio, niche, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      email,
      passwordHash,
      name,
      handle.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      channelTitle || `${name}'s Channel`,
      channelUrl || '',
      platform || 'youtube',
      0,
      `https://api.dicebear.com/7.x/bottts/svg?seed=${handle}`,
      'Digital content creator',
      'Tech & Lifestyle',
      now,
      now
    )
    .run();

  // Create default bio page
  await c.env.DB
    .prepare(
      `INSERT INTO bio_pages (
        id, creator_id, handle, theme, custom_title, custom_bio, accent_color, bg_color, is_published, views_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
    )
    .bind(
      `bio_${id}`,
      id,
      handle.toLowerCase(),
      'dna-accent',
      name,
      'Welcome to my official creator links and gear collection.',
      '#6366f1',
      '#0f172a',
      now,
      now
    )
    .run();

  // Set session
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  await c.env.DB
    .prepare('INSERT INTO sessions (id, creator_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, id, expires, now)
    .run();

  setCookie(c, 'cb_session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 86400,
  });

  const creator = await dbClient.getCreator(id);
  return c.json({ success: true, creator });
});

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  const hash = await hashPassword(password);
  const creator = await c.env.DB
    .prepare('SELECT * FROM creators WHERE email = ? AND password_hash = ?')
    .bind(email, hash)
    .first<Creator>();

  if (!creator) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expires = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

  await c.env.DB
    .prepare('INSERT INTO sessions (id, creator_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, creator.id, expires, new Date().toISOString())
    .run();

  setCookie(c, 'cb_session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 86400,
  });

  return c.json({ success: true, creator });
});

authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'cb_session');
  return c.json({ success: true });
});
