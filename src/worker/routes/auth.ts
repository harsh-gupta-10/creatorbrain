import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { DBClient } from '../db/queries';
import type { Creator } from '../../shared/types';

export const authRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
  };
}>();

export const SAMPLE_CREATOR_ID = 'creator_demo_tech_kabir';
const SESSION_COOKIE = 'cb_session';
const SESSION_DAYS = 30;
// Workers caps PBKDF2 at 100k iterations; 100k also stays inside the free tier CPU budget
const PBKDF2_ITERATIONS = 100_000;
const LEGACY_SALT = 'creatorbrain_auth_salt_2026';
const RECOVERY_CODE_COUNT = 8;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hashRecoveryCode(code: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.trim().toLowerCase()));
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(password: string, salt: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPassword(
  password: string,
  row: { password_hash?: string | null; password_salt?: string | null }
): Promise<boolean> {
  if (!row.password_hash) return false;
  if (row.password_salt) {
    // Stored as "<iterations>:<salt>" so the cost can change without breaking old accounts
    const [iter, salt] = row.password_salt.includes(':')
      ? row.password_salt.split(':', 2)
      : [String(PBKDF2_ITERATIONS), row.password_salt];
    return safeEqual(await derive(password, salt, Number(iter)), row.password_hash);
  }
  // Accounts created before per-user salts used a shared salt and 50k iterations
  return safeEqual(await derive(password, LEGACY_SALT, 50_000), row.password_hash);
}

export interface SessionInfo {
  creator: Creator | null;
  isSample: boolean;
}

export async function getSession(db: D1Database, sessionId?: string): Promise<SessionInfo> {
  if (!sessionId) return { creator: null, isSample: false };

  const session = await db
    .prepare('SELECT creator_id FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(sessionId, new Date().toISOString())
    .first<{ creator_id: string }>();
  if (!session) return { creator: null, isSample: false };

  const creator = await new DBClient(db).getCreator(session.creator_id);
  return { creator, isSample: session.creator_id === SAMPLE_CREATOR_ID };
}

async function startSession(c: Context, creatorId: string): Promise<void> {
  const sessionId = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000).toISOString();

  await c.env.DB.prepare('INSERT INTO sessions (id, creator_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, creatorId, expires, now.toISOString())
    .run();

  const isLocal = new URL(c.req.url).protocol === 'http:';
  setCookie(c, SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'Lax',
    maxAge: SESSION_DAYS * 86400,
  });
}

function publicCreator(creator: Creator | null) {
  if (!creator) return null;
  const {
    password_hash: _h,
    password_salt: _s,
    ...rest
  } = creator as Creator & {
    password_hash?: string;
    password_salt?: string;
  };
  return rest;
}

const SignupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(12, 'Use at least 12 characters').max(200),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,30}$/, 'Handle can use 3 to 30 letters, numbers, - or _'),
});

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const RecoverySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().min(32).max(40),
  password: z.string().min(12).max(200),
});

authRoutes.get('/me', async (c) => {
  const { creator, isSample } = await getSession(c.env.DB, getCookie(c, SESSION_COOKIE));
  return c.json({
    authenticated: !!creator,
    isDemo: isSample,
    isSample,
    creator: publicCreator(creator),
  });
});

authRoutes.get('/handle-available', async (c) => {
  const handle = (c.req.query('handle') || '').toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(handle)) return c.json({ available: false });
  const existing = await new DBClient(c.env.DB).getCreatorByHandle(handle);
  return c.json({ available: !existing });
});

// Read-only sample workspace, reachable from the landing page
authRoutes.post('/sample', async (c) => {
  const creator = await new DBClient(c.env.DB).getCreator(SAMPLE_CREATOR_ID);
  if (!creator) return c.json({ error: 'The sample workspace is not available' }, 404);
  await startSession(c, SAMPLE_CREATOR_ID);
  return c.json({ success: true, isSample: true, isDemo: true, creator: publicCreator(creator) });
});
// Older clients call /demo
authRoutes.post('/demo', (c) => c.redirect('/api/auth/sample', 307));

authRoutes.post('/signup', async (c) => {
  const parsed = SignupSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  }
  const { name, email, password, handle } = parsed.data;
  const db = c.env.DB;
  const dbClient = new DBClient(db);

  if (await dbClient.getCreatorByHandle(handle)) {
    return c.json({ error: 'That handle is taken', field: 'handle' }, 409);
  }
  const emailTaken = await db.prepare('SELECT id FROM creators WHERE email = ?').bind(email).first();
  if (emailTaken) {
    return c.json({ error: 'An account with this email already exists', field: 'email' }, 409);
  }

  const id = `creator_${crypto.randomUUID()}`;
  const salt = randomToken(16);
  const passwordHash = await derive(password, salt, PBKDF2_ITERATIONS);
  const storedSalt = `${PBKDF2_ITERATIONS}:${salt}`;
  const now = new Date().toISOString();
  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomToken(16));
  const recoveryRows = await Promise.all(
    recoveryCodes.map(async (code) => ({ code, hash: bytesToHex(await hashRecoveryCode(code)) }))
  );

  await db.batch([
    db
      .prepare(
        `INSERT INTO creators (
          id, email, password_hash, password_salt, name, handle, channel_title, channel_url,
          platform, subscribers, avatar_url, bio, niche, onboarding_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'youtube', 0, NULL, '', '', 'profile', ?, ?)`
      )
      .bind(id, email, passwordHash, storedSalt, name, handle, name, now, now),
    db
      .prepare(
        `INSERT INTO bio_pages (
          id, creator_id, handle, theme, custom_title, custom_bio, accent_color, bg_color, is_published, views_count, created_at, updated_at
        ) VALUES (?, ?, ?, 'minimal-dark', ?, '', '#5b7cfa', '#111214', 1, 0, ?, ?)`
      )
      .bind(`bio_${id}`, id, handle, name, now, now),
    ...recoveryRows.map(({ hash }) =>
      db
        .prepare('INSERT INTO account_recovery_codes (code_hash, creator_id, created_at) VALUES (?, ?, ?)')
        .bind(hash, id, now)
    ),
  ]);

  await startSession(c, id);
  const creator = await dbClient.getCreator(id);
  return c.json({ success: true, creator: publicCreator(creator), recoveryCodes });
});

authRoutes.post('/login', async (c) => {
  const parsed = LoginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  }
  const { email, password } = parsed.data;

  const row = await c.env.DB.prepare('SELECT * FROM creators WHERE email = ?')
    .bind(email)
    .first<Creator & { password_hash?: string; password_salt?: string }>();

  if (!row || row.id === SAMPLE_CREATOR_ID || !(await verifyPassword(password, row))) {
    return c.json({ error: 'Email or password is incorrect' }, 401);
  }

  const unusedCodes = await c.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM account_recovery_codes WHERE creator_id = ? AND used_at IS NULL'
  )
    .bind(row.id)
    .first<{ count: number }>();
  let recoveryCodes: string[] | undefined;
  if (!unusedCodes?.count) {
    // Older accounts and accounts that used every code receive a fresh set after password verification.
    recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomToken(16));
    const recoveryRows = await Promise.all(recoveryCodes.map(async (code) => bytesToHex(await hashRecoveryCode(code))));
    await c.env.DB.batch(
      recoveryRows.map((hash) =>
        c.env.DB.prepare(
          'INSERT OR IGNORE INTO account_recovery_codes (code_hash, creator_id, created_at) VALUES (?, ?, ?)'
        ).bind(hash, row.id, new Date().toISOString())
      )
    );
  }

  await startSession(c, row.id);
  return c.json({ success: true, creator: publicCreator(row), ...(recoveryCodes ? { recoveryCodes } : {}) });
});

authRoutes.post('/recover', async (c) => {
  const parsed = RecoverySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Recovery details are invalid or already used' }, 400);

  const { email, password } = parsed.data;
  const code = parsed.data.code.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(code)) {
    return c.json({ error: 'Recovery details are invalid or already used' }, 400);
  }

  const db = c.env.DB;
  const now = new Date().toISOString();
  const claim = `${now}:${randomToken(8)}`;
  const codeHash = bytesToHex(await hashRecoveryCode(code));
  const salt = randomToken(16);
  const passwordHash = await derive(password, salt, PBKDF2_ITERATIONS);
  const results = await db.batch([
    db
      .prepare(
        `UPDATE account_recovery_codes SET used_at = ?
         WHERE code_hash = ? AND used_at IS NULL
           AND creator_id = (SELECT id FROM creators WHERE email = ? AND id != ?)`
      )
      .bind(claim, codeHash, email, SAMPLE_CREATOR_ID),
    db
      .prepare(
        `UPDATE creators SET password_hash = ?, password_salt = ?, updated_at = ?
         WHERE email = ? AND id != ? AND id = (
           SELECT creator_id FROM account_recovery_codes WHERE code_hash = ? AND used_at = ?
         )`
      )
      .bind(passwordHash, `${PBKDF2_ITERATIONS}:${salt}`, now, email, SAMPLE_CREATOR_ID, codeHash, claim),
    db
      .prepare(
        `DELETE FROM sessions WHERE creator_id = (
           SELECT creator_id FROM account_recovery_codes WHERE code_hash = ? AND used_at = ?
         )`
      )
      .bind(codeHash, claim),
  ]);

  if (!results[0]?.meta.changes) {
    return c.json({ error: 'Recovery details are invalid or already used' }, 400);
  }
  return c.json({ success: true });
});

authRoutes.post('/recovery-codes', async (c) => {
  const session = await getSession(c.env.DB, getCookie(c, SESSION_COOKIE));
  if (!session.creator || session.isSample) return c.json({ error: 'Sign in to continue' }, 401);

  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Enter your current password to continue' }, 400);
  const row = await c.env.DB.prepare('SELECT password_hash, password_salt FROM creators WHERE id = ?')
    .bind(session.creator.id)
    .first<{ password_hash?: string | null; password_salt?: string | null }>();
  if (!row || !(await verifyPassword(parsed.data.password, row))) {
    return c.json({ error: 'Your current password is incorrect' }, 401);
  }

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomToken(16));
  const now = new Date().toISOString();
  const creatorId = session.creator.id;
  const recoveryRows = await Promise.all(recoveryCodes.map(async (code) => bytesToHex(await hashRecoveryCode(code))));
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM account_recovery_codes WHERE creator_id = ?').bind(creatorId),
    ...recoveryRows.map((hash) =>
      c.env.DB.prepare('INSERT INTO account_recovery_codes (code_hash, creator_id, created_at) VALUES (?, ?, ?)').bind(
        hash,
        creatorId,
        now
      )
    ),
  ]);

  return c.json({ recoveryCodes });
});

authRoutes.post('/logout', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ success: true });
});
