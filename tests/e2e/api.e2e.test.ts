/**
 * End-to-end API tests against the real Worker running locally (Miniflare + local D1).
 * Run with: npm run test:e2e
 *
 * Covers auth, session handling, the read-only sample workspace, CSRF protection,
 * input validation, encrypted per-creator Amazon credentials, security headers,
 * and escaping on the public creator page. No external AI or YouTube calls are made.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';

type Worker = Awaited<ReturnType<typeof unstable_dev>>;

const PERSIST = '.wrangler/e2e-state';
let worker: Worker;
let base = '';

beforeAll(async () => {
  rmSync(PERSIST, { recursive: true, force: true });
  execSync(`npx wrangler d1 migrations apply creatorbrain-db --local --persist-to ${PERSIST}`, { stdio: 'ignore' });
  worker = await unstable_dev('src/worker/index.ts', {
    experimental: { disableExperimentalWarning: true },
    persistTo: PERSIST,
    vars: { ENVIRONMENT: 'test', ENCRYPTION_KEY: 'e2e-test-encryption-key-0123456789abcdef' },
    ip: '127.0.0.1',
  });
  base = `http://${worker.address}:${worker.port}`;
}, 120_000);

afterAll(async () => {
  await worker?.stop();
});

/** Minimal cookie-keeping client. Each client gets its own IP so the auth rate limit is per test */
let ipCounter = 1;
function client(ip = `10.0.0.${ipCounter++}`) {
  let cookie = '';
  return async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    if (init.json !== undefined) headers.set('Content-Type', 'application/json');
    if (cookie) headers.set('Cookie', cookie);
    headers.set('CF-Connecting-IP', ip);
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return res;
  };
}

// Fake credentials, assembled at runtime so secret scanners don't mistake them for real keys
const FAKE_ACCESS_KEY = ['AK', 'IA', 'TESTONLY', 'FAKE1234'].join('');
const FAKE_SECRET_KEY = ['test', 'only', '-not-a-real-secret-', '0123456789'].join('');

const uniq = () => Math.random().toString(36).slice(2, 8);

async function signup(api: ReturnType<typeof client>) {
  const id = uniq();
  const res = await api('/api/auth/signup', {
    method: 'POST',
    json: { name: 'Maya Test', handle: `maya${id}`, email: `maya${id}@example.com`, password: 'correct-horse-9' },
  });
  return { res, handle: `maya${id}`, email: `maya${id}@example.com` };
}

describe('Auth', () => {
  it('rejects unauthenticated API calls', async () => {
    const res = await fetch(`${base}/api/studio/projects`);
    expect(res.status).toBe(401);
  });

  it('validates signup input', async () => {
    const api = client();
    const res = await api('/api/auth/signup', { method: 'POST', json: { name: 'x', email: 'nope', password: '1', handle: '!' } });
    expect(res.status).toBe(400);
  });

  it('signs up, starts onboarding, never returns password material', async () => {
    const api = client();
    const { res } = await signup(api);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.creator.onboarding_status).toBe('profile');
    expect(body.creator.password_hash).toBeUndefined();
    expect(body.creator.password_salt).toBeUndefined();
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);

    const me = (await (await api('/api/auth/me')).json()) as any;
    expect(me.authenticated).toBe(true);
    expect(me.isSample).toBe(false);
  });

  it('rejects a duplicate handle', async () => {
    const a = client();
    const { handle } = await signup(a);
    const b = client();
    const res = await b('/api/auth/signup', {
      method: 'POST',
      json: { name: 'Other', handle, email: `other${uniq()}@example.com`, password: 'correct-horse-9' },
    });
    expect(res.status).toBe(409);
  });

  it('logs in with the right password only, and logout ends the session', async () => {
    const a = client();
    const { email } = await signup(a);
    const b = client();
    expect((await b('/api/auth/login', { method: 'POST', json: { email, password: 'wrong-password' } })).status).toBe(401);
    expect((await b('/api/auth/login', { method: 'POST', json: { email, password: 'correct-horse-9' } })).status).toBe(200);
    expect((await b('/api/studio/projects')).status).toBe(200);
    await b('/api/auth/logout', { method: 'POST' });
    expect((await b('/api/studio/projects')).status).toBe(401);
  });
});

describe('Request safety', () => {
  it('rate limits repeated sign-in attempts from one IP', async () => {
    const api = client('10.9.9.9');
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await api('/api/auth/login', { method: 'POST', json: { email: 'nobody@example.com', password: 'wrong-password' } });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('blocks cross-site writes', async () => {
    const api = client();
    await signup(api);
    const res = await api('/api/studio/projects', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      json: { title: 'x', brief: 'y' },
    });
    expect(res.status).toBe(403);
  });

  it('sends security headers', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('Sample workspace', () => {
  it('is readable but read-only', async () => {
    const api = client();
    expect((await api('/api/auth/sample', { method: 'POST' })).status).toBe(200);
    expect((await api('/api/onboarding/content')).status).toBe(200);
    const write = await api('/api/studio/projects', { method: 'POST', json: { title: 'x', brief: 'y' } });
    expect(write.status).toBe(403);
    expect(((await write.json()) as any).sample).toBe(true);
  });
});

describe('Onboarding', () => {
  it('requires something to study', async () => {
    const api = client();
    await signup(api);
    const res = await api('/api/onboarding/profile', { method: 'POST', json: { niche: 'Cooking', youtube: '', instagramCaptions: [] } });
    expect(res.status).toBe(400);
  });

  it('requires a valid tracking ID when Amazon is on', async () => {
    const api = client();
    await signup(api);
    const res = await api('/api/onboarding/profile', {
      method: 'POST',
      json: { niche: 'Cooking', instagramCaptions: ['Weeknight dal'], amazon: { enabled: true, partnerTag: '' } },
    });
    expect(res.status).toBe(400);
  });

  it('saves the profile and stores captions as content to study', async () => {
    const api = client();
    await signup(api);
    const res = await api('/api/onboarding/profile', {
      method: 'POST',
      json: {
        niche: 'Home cooking',
        instagramCaptions: ['One-pan dal in 20 minutes\n#dinner', 'Why is my bread dense?'],
        amazon: { enabled: true, partnerTag: 'maya-20', marketplace: 'amazon.in' },
        otherIncome: ['Brand sponsorships'],
        goals: ['Grow subscribers'],
      },
    });
    expect(res.status).toBe(200);
    const library = (await (await api('/api/content')).json()) as any;
    expect(library.items).toHaveLength(2);
    expect(library.counts.pending).toBe(2);
  });
});

describe('Study in the app', () => {
  it('opens the app right after setup and lets the creator fix the channel link', async () => {
    const api = client();
    await signup(api);
    await api('/api/onboarding/profile', { method: 'POST', json: { niche: 'Cooking', instagramCaptions: ['Weeknight dal'] } });
    const me = (await (await api('/api/auth/me')).json()) as any;
    expect(me.creator.onboarding_status).toBe('ready');

    const first = (await (await api('/api/onboarding/study/start', { method: 'POST' })).json()) as any;
    const second = (await (await api('/api/onboarding/study/start', { method: 'POST' })).json()) as any;
    expect(second.jobId).toBe(first.jobId); // no duplicate studies

    const active = (await (await api('/api/onboarding/study/active')).json()) as any;
    expect(active.job.id).toBe(first.jobId);
    expect(active.job.status).toBe('running');

    expect((await api('/api/onboarding/channel', { method: 'PUT', json: { youtube: '' } })).status).toBe(400);
    expect((await api('/api/onboarding/channel', { method: 'PUT', json: { youtube: 'https://www.youtube.com/@someone' } })).status).toBe(200);
    const after = (await (await api('/api/auth/me')).json()) as any;
    expect(after.creator.youtube_input).toBe('https://www.youtube.com/@someone');
  });
});

describe('Brand deals', () => {
  it('creates, moves and deletes a deal, scoped to its creator', async () => {
    const api = client();
    await signup(api);
    expect((await api('/api/deals', { method: 'POST', json: { brand: '' } })).status).toBe(400);
    const created = await api('/api/deals', {
      method: 'POST',
      json: { brand: 'Spice Co.', amount: 600, currency: 'USD', stage: 'posted', due_date: '2026-11-10' },
    });
    expect(created.status).toBe(201);
    const { deal } = (await created.json()) as any;

    const paid = (await (await api(`/api/deals/${deal.id}`, { method: 'PATCH', json: { stage: 'paid' } })).json()) as any;
    expect(paid.deal.stage).toBe('paid');
    expect(paid.deal.paid_at).toBeTruthy();

    const other = client();
    await signup(other);
    expect((await other(`/api/deals/${deal.id}`, { method: 'PATCH', json: { stage: 'talking' } })).status).toBe(404);
    expect(((await (await other('/api/deals')).json()) as any).deals).toHaveLength(0);

    expect((await api(`/api/deals/${deal.id}`, { method: 'DELETE' })).status).toBe(200);
    expect(((await (await api('/api/deals')).json()) as any).deals).toHaveLength(0);
  });
});

describe('Saved conversations', () => {
  it('validates thread names and starts empty for a new creator', async () => {
    const api = client();
    await signup(api);
    expect((await api('/api/chats/not-a-thread')).status).toBe(400);
    const res = (await (await api('/api/chats/copilot')).json()) as any;
    expect(res.messages).toEqual([]);
    expect((await api('/api/chats/studio:proj_123', { method: 'DELETE' })).status).toBe(200);
  });
});

describe('Free audit', () => {
  it('is public and validates input', async () => {
    const res = await fetch(`${base}/api/public/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.8.8.8' },
      body: JSON.stringify({ channel: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Amazon credentials', () => {
  it('stores keys encrypted and only ever returns a hint', async () => {
    const api = client();
    await signup(api);
    const save = await api('/api/settings/amazon', {
      method: 'PUT',
      json: { partnerTag: 'maya-20', marketplace: 'amazon.com', accessKey: FAKE_ACCESS_KEY, secretKey: FAKE_SECRET_KEY },
    });
    expect(save.status).toBe(200);
    const saved = (await save.json()) as any;
    expect(saved.hasCredentials).toBe(true);
    expect(saved.accessKeyHint).toBe(`••••${FAKE_ACCESS_KEY.slice(-4)}`);
    expect(JSON.stringify(saved)).not.toContain(FAKE_ACCESS_KEY);

    const settings = (await (await api('/api/settings')).json()) as any;
    expect(settings.amazonConfig.partnerTag).toBe('maya-20');
    expect(JSON.stringify(settings)).not.toContain(FAKE_SECRET_KEY);

    const link = (await (
      await api('/api/amazon/build-link', { method: 'POST', json: { productUrl: 'https://www.amazon.com/dp/B000000001' } })
    ).json()) as any;
    expect(link.taggedUrl).toBe('https://www.amazon.com/dp/B000000001?tag=maya-20');
  });

  it('rejects half a key pair and non-Amazon links', async () => {
    const api = client();
    await signup(api);
    expect((await api('/api/settings/amazon', { method: 'PUT', json: { accessKey: FAKE_ACCESS_KEY } })).status).toBe(400);
    expect((await api('/api/amazon/build-link', { method: 'POST', json: { productUrl: 'https://evil.example/x' } })).status).toBe(400);
  });

  it("keeps each creator's tracking ID private to them", async () => {
    const a = client();
    await signup(a);
    await a('/api/settings/monetization', { method: 'PUT', json: { amazon: true, partnerTag: 'alpha-20', marketplace: 'amazon.com' } });
    const b = client();
    await signup(b);
    const settings = (await (await b('/api/settings')).json()) as any;
    expect(settings.amazonConfig.partnerTag).toBe('');
  });
});

describe('Public creator page', () => {
  it('escapes creator-controlled text', async () => {
    const api = client();
    const { handle } = await signup(api);
    await api('/api/bio/page', { method: 'PUT', json: { custom_title: '<script>alert(1)</script>', custom_bio: '"><img src=x onerror=alert(1)>' } });
    const res = await fetch(`${base}/@${handle}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;script&gt;');
  });
});
