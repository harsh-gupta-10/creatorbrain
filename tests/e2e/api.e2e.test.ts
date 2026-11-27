/**
 * End-to-end API tests against the real Worker running locally (Miniflare + local D1).
 * Run with: npm run test:e2e
 *
 * Covers auth, session handling, the read-only sample workspace, CSRF protection,
 * input validation, encrypted per-creator Amazon credentials, security headers,
 * and escaping on the public creator page. No external AI or YouTube calls are made.
 */
import { execFileSync, execSync } from 'node:child_process';
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
    const res = await api('/api/auth/signup', {
      method: 'POST',
      json: { name: 'x', email: 'nope', password: '1', handle: '!' },
    });
    expect(res.status).toBe(400);
  });

  it('signs up, starts onboarding, never returns password material', async () => {
    const api = client();
    const { res } = await signup(api);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      creator: { onboarding_status: string; password_hash?: unknown; password_salt?: unknown };
    };
    expect(body.creator.onboarding_status).toBe('profile');
    expect(body.creator.password_hash).toBeUndefined();
    expect(body.creator.password_salt).toBeUndefined();
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);

    const me = (await (await api('/api/auth/me')).json()) as { authenticated: boolean; isSample: boolean };
    expect(me.authenticated).toBe(true);
    expect(me.isSample).toBe(false);
  });

  it('issues one-time recovery codes, resets the password, and invalidates sessions', async () => {
    const api = client();
    const { res, email } = await signup(api);
    const body = (await res.json()) as { recoveryCodes: string[] };
    expect(body.recoveryCodes).toHaveLength(8);
    expect(new Set(body.recoveryCodes).size).toBe(8);

    const recovery = await client()('/api/auth/recover', {
      method: 'POST',
      json: { email, code: body.recoveryCodes[0], password: 'new-correct-horse-10' },
    });
    expect(recovery.status).toBe(200);
    const meAfterReset = (await (await api('/api/auth/me')).json()) as { authenticated: boolean };
    expect(meAfterReset.authenticated).toBe(false);

    const replay = await client()('/api/auth/recover', {
      method: 'POST',
      json: { email, code: body.recoveryCodes[0], password: 'another-correct-horse-11' },
    });
    expect(replay.status).toBe(400);

    const loggedInClient = client();
    const login = await loggedInClient('/api/auth/login', {
      method: 'POST',
      json: { email, password: 'new-correct-horse-10' },
    });
    expect(login.status).toBe(200);

    const rotate = await loggedInClient('/api/auth/recovery-codes', {
      method: 'POST',
      json: { password: 'new-correct-horse-10' },
    });
    expect(rotate.status).toBe(200);
    const rotated = (await rotate.json()) as { recoveryCodes: string[] };
    expect(rotated.recoveryCodes).toHaveLength(8);

    const oldCode = await client()('/api/auth/recover', {
      method: 'POST',
      json: { email, code: body.recoveryCodes[1], password: 'another-correct-horse-11' },
    });
    expect(oldCode.status).toBe(400);

    const newCode = await client()('/api/auth/recover', {
      method: 'POST',
      json: { email, code: rotated.recoveryCodes[0], password: 'another-correct-horse-11' },
    });
    expect(newCode.status).toBe(200);
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
    expect((await b('/api/auth/login', { method: 'POST', json: { email, password: 'wrong-password' } })).status).toBe(
      401
    );
    expect((await b('/api/auth/login', { method: 'POST', json: { email, password: 'correct-horse-9' } })).status).toBe(
      200
    );
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
      const res = await api('/api/auth/login', {
        method: 'POST',
        json: { email: 'nobody@example.com', password: 'wrong-password' },
      });
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
    expect(((await write.json()) as { sample: boolean }).sample).toBe(true);
  });

  it('does not reveal pending quiz answers before submission', async () => {
    const api = client();
    await api('/api/auth/sample', { method: 'POST' });
    const response = await api('/api/assess/quizzes');
    const { quizzes } = (await response.json()) as {
      quizzes: { status: string; questions_json: string }[];
    };
    const pendingQuiz = quizzes.find((quiz) => quiz.status === 'pending');
    expect(pendingQuiz).toBeTruthy();
    const questions = JSON.parse(pendingQuiz!.questions_json) as Record<string, unknown>[];
    expect(questions[0]).not.toHaveProperty('correctIndex');
    expect(questions[0]).not.toHaveProperty('explanation');
  });
});

describe('Short links', () => {
  it('rejects private destinations and expired links, and redirects public URLs', async () => {
    const api = client();
    await signup(api);

    for (const destination_url of ['http://172.31.0.1/admin', 'http://[::1]/admin']) {
      const blocked = await api('/api/links/create', { method: 'POST', json: { destination_url } });
      expect(blocked.status).toBe(400);
    }

    const expired = await api('/api/links/create', {
      method: 'POST',
      json: { destination_url: 'https://example.com', expires_at: '2020-01-01T00:00:00.000Z' },
    });
    expect(expired.status).toBe(400);

    const created = await api('/api/links/create', {
      method: 'POST',
      json: { destination_url: 'https://example.com/creatorbrain', slug: `test-${uniq()}` },
    });
    expect(created.status).toBe(200);
    const { shortLink } = (await created.json()) as { shortLink: { slug: string } };
    const redirect = await fetch(`${base}/s/${shortLink.slug}`, { redirect: 'manual' });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('https://example.com/creatorbrain');
  });
});

describe('Onboarding', () => {
  it('requires something to study', async () => {
    const api = client();
    await signup(api);
    const res = await api('/api/onboarding/profile', {
      method: 'POST',
      json: { niche: 'Cooking', youtube: '', instagramCaptions: [] },
    });
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
    const library = (await (await api('/api/content')).json()) as { items: unknown[]; counts: { pending: number } };
    expect(library.items).toHaveLength(2);
    expect(library.counts.pending).toBe(2);
  });
});

describe('Study in the app', () => {
  it('opens the app right after setup and lets the creator fix the channel link', async () => {
    const api = client();
    await signup(api);
    await api('/api/onboarding/profile', {
      method: 'POST',
      json: { niche: 'Cooking', instagramCaptions: ['Weeknight dal'] },
    });
    const me = (await (await api('/api/auth/me')).json()) as { creator: { onboarding_status: string } };
    expect(me.creator.onboarding_status).toBe('ready');

    const first = (await (await api('/api/onboarding/study/start', { method: 'POST' })).json()) as { jobId: string };
    const second = (await (await api('/api/onboarding/study/start', { method: 'POST' })).json()) as { jobId: string };
    expect(second.jobId).toBe(first.jobId); // no duplicate studies

    const active = (await (await api('/api/onboarding/study/active')).json()) as {
      job: { id: string; status: string };
    };
    expect(active.job.id).toBe(first.jobId);
    expect(active.job.status).toBe('running');

    expect((await api('/api/onboarding/channel', { method: 'PUT', json: { youtube: '' } })).status).toBe(400);
    expect(
      (await api('/api/onboarding/channel', { method: 'PUT', json: { youtube: 'https://www.youtube.com/@someone' } }))
        .status
    ).toBe(200);
    const after = (await (await api('/api/auth/me')).json()) as { creator: { youtube_input: string } };
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
    const { deal } = (await created.json()) as { deal: { id: string } };

    const paid = (await (await api(`/api/deals/${deal.id}`, { method: 'PATCH', json: { stage: 'paid' } })).json()) as {
      deal: { stage: string; paid_at: string | null };
    };
    expect(paid.deal.stage).toBe('paid');
    expect(paid.deal.paid_at).toBeTruthy();

    const other = client();
    await signup(other);
    expect((await other(`/api/deals/${deal.id}`, { method: 'PATCH', json: { stage: 'talking' } })).status).toBe(404);
    expect(((await (await other('/api/deals')).json()) as { deals: unknown[] }).deals).toHaveLength(0);

    expect((await api(`/api/deals/${deal.id}`, { method: 'DELETE' })).status).toBe(200);
    expect(((await (await api('/api/deals')).json()) as { deals: unknown[] }).deals).toHaveLength(0);
  });
});

describe('Writing preferences', () => {
  it('saves the script language and rejects unknown values', async () => {
    const api = client();
    await signup(api);
    expect(
      (await api('/api/settings/preferences', { method: 'PUT', json: { scriptLanguage: 'klingon' } })).status
    ).toBe(400);
    expect(
      (await api('/api/settings/preferences', { method: 'PUT', json: { scriptLanguage: 'hinglish' } })).status
    ).toBe(200);
    const me = (await (await api('/api/auth/me')).json()) as { creator: { script_language: string } };
    expect(me.creator.script_language).toBe('hinglish');
  });
});

describe('Saved conversations', () => {
  it('validates thread names and starts empty for a new creator', async () => {
    const api = client();
    await signup(api);
    expect((await api('/api/chats/not-a-thread')).status).toBe(400);
    const res = (await (await api('/api/chats/copilot')).json()) as { messages: unknown[] };
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
      json: {
        partnerTag: 'maya-20',
        marketplace: 'amazon.com',
        accessKey: FAKE_ACCESS_KEY,
        secretKey: FAKE_SECRET_KEY,
      },
    });
    expect(save.status).toBe(200);
    const saved = (await save.json()) as { hasCredentials: boolean; accessKeyHint: string };
    expect(saved.hasCredentials).toBe(true);
    expect(saved.accessKeyHint).toBe(`••••${FAKE_ACCESS_KEY.slice(-4)}`);
    expect(JSON.stringify(saved)).not.toContain(FAKE_ACCESS_KEY);

    const settings = (await (await api('/api/settings')).json()) as { amazonConfig: { partnerTag: string } };
    expect(settings.amazonConfig.partnerTag).toBe('maya-20');
    expect(JSON.stringify(settings)).not.toContain(FAKE_SECRET_KEY);

    const link = (await (
      await api('/api/amazon/build-link', {
        method: 'POST',
        json: { productUrl: 'https://www.amazon.com/dp/B000000001' },
      })
    ).json()) as { taggedUrl: string };
    expect(link.taggedUrl).toBe('https://www.amazon.com/dp/B000000001?tag=maya-20');
  });

  it('stores Creators API credentials encrypted and keeps the version visible without returning secrets', async () => {
    const api = client();
    await signup(api);
    const credentialId = 'amzn1.application-oa2-client.example1234';
    const credentialSecret = 'fake-creator-api-secret-for-test-only-123456';
    const save = await api('/api/settings/amazon', {
      method: 'PUT',
      json: {
        partnerTag: 'maya-20',
        marketplace: 'amazon.in',
        credentialId,
        credentialSecret,
        credentialVersion: 'v3.2',
      },
    });
    expect(save.status).toBe(200);
    const saved = (await save.json()) as {
      hasCredentials: boolean;
      apiType: string;
      credentialIdHint: string;
      credentialVersion: string;
    };
    expect(saved.hasCredentials).toBe(true);
    expect(saved.apiType).toBe('creators');
    expect(saved.credentialIdHint).toBe('••••1234');
    expect(saved.credentialVersion).toBe('3.2');
    expect(JSON.stringify(saved)).not.toContain(credentialId);
    expect(JSON.stringify(saved)).not.toContain(credentialSecret);

    const settings = await (await api('/api/settings')).json();
    expect(JSON.stringify(settings)).not.toContain(credentialId);
    expect(JSON.stringify(settings)).not.toContain(credentialSecret);
  });

  it('rejects half a key pair and non-Amazon links', async () => {
    const api = client();
    await signup(api);
    expect((await api('/api/settings/amazon', { method: 'PUT', json: { accessKey: FAKE_ACCESS_KEY } })).status).toBe(
      400
    );
    expect(
      (
        await api('/api/settings/amazon', {
          method: 'PUT',
          json: { partnerTag: 'maya-20', credentialId: 'amzn1.application-oa2-client.example' },
        })
      ).status
    ).toBe(400);
    expect(
      (
        await api('/api/settings/amazon', {
          method: 'PUT',
          json: {
            partnerTag: 'maya-20',
            credentialId: 'amzn1.application-oa2-client.example',
            credentialSecret: 'fake-creator-api-secret-for-test-only-123456',
          },
        })
      ).status
    ).toBe(400);
    expect(
      (await api('/api/amazon/build-link', { method: 'POST', json: { productUrl: 'https://evil.example/x' } })).status
    ).toBe(400);
  });

  it("keeps each creator's tracking ID private to them", async () => {
    const a = client();
    await signup(a);
    await a('/api/settings/monetization', {
      method: 'PUT',
      json: { amazon: true, partnerTag: 'alpha-20', marketplace: 'amazon.com' },
    });
    const b = client();
    await signup(b);
    const settings = (await (await b('/api/settings')).json()) as { amazonConfig: { partnerTag: string } };
    expect(settings.amazonConfig.partnerTag).toBe('');
  });
});

describe('Public creator page', () => {
  it('stores uploaded bio icons in creator-scoped R2 and serves them through the Worker', async () => {
    const owner = client();
    await signup(owner);
    const form = new FormData();
    form.set('file', new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'icon.png');
    const uploaded = await owner('/api/bio/icons', { method: 'POST', body: form });
    expect(uploaded.status).toBe(200);
    const { iconUrl } = (await uploaded.json()) as { iconUrl: string };
    expect(iconUrl).toMatch(/^\/bio-icons\/[0-9a-f-]{36}\.png$/i);

    const image = await fetch(`${base}${iconUrl}`);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');

    const other = client();
    await signup(other);
    await other('/api/bio/icons', { method: 'DELETE', json: { iconUrl } });
    expect((await fetch(`${base}${iconUrl}`)).status).toBe(200);

    await owner('/api/bio/icons', { method: 'DELETE', json: { iconUrl } });
    expect((await fetch(`${base}${iconUrl}`)).status).toBe(404);
  });

  it('escapes creator-controlled text', async () => {
    const api = client();
    const { handle } = await signup(api);
    await api('/api/bio/page', {
      method: 'PUT',
      json: { custom_title: '<script>alert(1)</script>', custom_bio: '"><img src=x onerror=alert(1)>' },
    });
    const res = await fetch(`${base}/@${handle}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<script src="/bio-analytics.js" defer></script>');
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
  });
});

describe('Creator agents', () => {
  it('keeps saved briefs private and rejects unsupported competitor targets', async () => {
    const owner=client(), other=client();
    await signup(owner);
    await signup(other);
    const config={kind:'competitor',name:'Opening lines',focus:'Compare gadget review hooks',channel:'@example'};
    expect((await owner('/api/agents/saved',{method:'POST',json:{...config,channel:'https://example.com/'}})).status).toBe(400);
    const response=await owner('/api/agents/saved',{method:'POST',json:config});
    expect(response.status).toBe(201);
    const {agent}=await response.json() as {agent:{id:string}};
    expect(await (await other('/api/agents/saved')).json()).toEqual({agents:[]});
    expect((await other('/api/agents/saved/'+agent.id+'/run',{method:'POST'})).status).toBe(404);
    expect(await (await owner('/api/agents/saved')).json()).toMatchObject({agents:[config]});
  });

  it('answers a project affiliate request without credentials or modifying drafts', async () => {
    const owner=client();
    await signup(owner);
    const created=await owner('/api/studio/projects',{method:'POST',json:{title:'USB hub',brief:'Review a compact USB hub'}});
    const {project}=await created.json() as {project:{id:string}};
    const res=await owner('/api/studio/chat',{method:'POST',json:{projectId:project.id,message:'Get its Amazon affiliate link',productAsin:'B012345678'}});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({assets:[],reply:expect.stringContaining('Connect your tracking ID')});
  });
});

describe('Amazon link and earnings tools', () => {
  it('builds tagged links in Studio from a project URL with only a tracking ID', async () => {
    const owner = client();
    await signup(owner);
    await owner('/api/settings/amazon', { method: 'PUT', json: { partnerTag: 'fixture-21', marketplace: 'amazon.in' } });
    const url = 'https://www.amazon.in/dp/B012345678';
    const tagged = url + '?tag=fixture-21';
    const build = await owner('/api/amazon/build-link', { method: 'POST', json: { productUrl: 'B012345678' } });
    expect(await build.json()).toMatchObject({ taggedUrl: tagged });
    const { project } = await (await owner('/api/studio/projects', {
      method: 'POST', json: { title: 'A quiet USB hub', brief: 'Product page: ' + url },
    })).json() as { project: { id: string } };
    const chat = await owner('/api/studio/chat', {
      method: 'POST', json: { projectId: project.id, message: 'Find an Amazon affiliate link for the product in this project.' },
    });
    expect(chat.status).toBe(200);
    expect(await chat.json()).toMatchObject({ reply: expect.stringContaining(tagged), assets: [] });
    expect(await (await owner('/api/amazon/reports')).json()).toEqual({ configured: false, reports: [] });
  });

  it('imports dated India reports once per day and scopes earnings to the owner and marketplace', async () => {
    const owner = client();
    const other = client();
    await signup(owner);
    await signup(other);
    const connect = (marketplace: string) => owner('/api/settings/amazon', {
      method: 'PUT', json: { partnerTag: 'fixture-21', marketplace },
    });
    await connect('amazon.in');
    await other('/api/settings/amazon', { method: 'PUT', json: { partnerTag: 'other-21', marketplace: 'amazon.in' } });
    const upload = (csvText: string) => owner('/api/amazon/earnings/import-csv', { method: 'POST', json: { csvText } });
    const report = 'Date\tItems Dispatched\tTotal Earnings\n26/11/2026\t2\t200.50';
    expect((await upload(report)).status).toBe(200);
    expect((await upload(report)).status).toBe(200);
    expect((await upload('Date,Advertising Fees\n2026-02-30,200')).status).toBe(400);
    expect(await (await owner('/api/amazon/earnings')).json()).toMatchObject({
      marketplace: 'amazon.in', earnings: [expect.anything()], summary: { totalCommission: 200.50, totalItems: 2 },
    });
    expect(await (await other('/api/amazon/earnings')).json()).toMatchObject({ earnings: [] });
    await connect('amazon.com');
    expect(await (await owner('/api/amazon/earnings')).json()).toMatchObject({ earnings: [] });
  });
});

describe('Chat tools', () => {
  it('shortens the previous Amazon affiliate result, preserves its tag, and tracks the Open Amazon click', async () => {
    const owner = client();
    const other = client();
    await signup(owner);
    await signup(other);
    const settings = await owner('/api/settings/amazon', {
      method: 'PUT', json: { partnerTag: 'fixture-21', marketplace: 'amazon.in' },
    });
    expect(settings.status).toBe(200);
    const { project } = await (await owner('/api/studio/projects', {
      method: 'POST', json: { title: 'Arduino review', brief: 'Show the board and explain how to get started' },
    })).json() as { project: { id: string } };
    const studio = (message: string) => owner('/api/studio/chat', { method: 'POST', json: { message, projectId: project.id } });
    const destination = 'https://www.amazon.in/dp/B012345678?th=1';
    const tagged = destination + '&tag=fixture-21';
    expect(await (await studio(destination)).json()).toMatchObject({ reply: expect.stringContaining(tagged) });
    const suggestions = `/api/brain/suggestions?projectId=${project.id}`;
    expect(await (await owner(suggestions)).json()).toMatchObject({
      suggestions: expect.arrayContaining([expect.objectContaining({ id: 'short-link', prompt: 'Make this a short link' })]),
    });
    expect((await other(suggestions)).status).toBe(404);
    expect(await (await owner('/api/brain/graph')).json()).toMatchObject({
      toolMemory: expect.arrayContaining([expect.objectContaining({ tool: 'affiliate_link' })]),
    });


    const created = await studio('i want short link');
    expect(created.status).toBe(200);
    const { shortLink } = await created.json() as { shortLink: string };
    expect(shortLink).toContain('/s/amazon-');
    expect(await (await studio('Make this a short link')).json()).toMatchObject({ shortLink });
    const result = await (await owner('/api/links')).json() as { links: { id: string; slug: string; destination_url: string }[] };
    expect(result.links).toHaveLength(1);
    expect(result.links[0].destination_url).toBe(tagged);
    expect(await (await owner(suggestions)).json()).toMatchObject({
      suggestions: expect.arrayContaining([expect.objectContaining({ id: 'clicks', prompt: '/link-stats ' + result.links[0].slug })]),
    });
    expect(await (await other('/api/brain/graph')).json()).toMatchObject({ toolMemory: [] });


    const confirmPage = await fetch(shortLink, { redirect: 'manual' });
    expect(confirmPage.status).toBe(200);
    expect(await confirmPage.text()).toContain('Open Amazon');
    const crossOrigin = await fetch(shortLink, { method: 'POST', headers: { Origin: 'https://example.com' }, redirect: 'manual' });
    expect(crossOrigin.status).toBe(403);
    expect(await (await studio('/link-stats')).json()).toMatchObject({ reply: expect.stringContaining('0 tracked clicks') });
    const click = await fetch(shortLink, { method: 'POST', headers: { Origin: base }, redirect: 'manual' });
    expect(click.status).toBe(303);
    expect(click.headers.get('Location')).toBe(tagged);
    await expect.poll(async () => (await (await studio('/link-stats')).json() as {reply: string}).reply)
      .toContain('1 tracked click');
    const stats = await other('/api/copilot/chat', { method: 'POST', json: { message: '/link-stats ' + shortLink } });
    expect(await stats.json()).toMatchObject({ reply: expect.stringContaining('couldn’t find') });
  });

  it('shortens a public URL in Copilot and keeps private or ambiguous URLs out of Short links', async () => {
    const owner = client();
    await signup(owner);
    const copilot = (message: string) => owner('/api/copilot/chat', { method: 'POST', json: { message } });
    expect(await (await copilot('/tools')).json()).toMatchObject({ reply: expect.stringContaining('/tool thumbnail') });
    expect(await (await copilot('/tool hook')).json()).toMatchObject({ reply: expect.stringContaining('Add a topic') });
    expect(await (await copilot('/shorten http://172.31.0.1/admin')).json()).toMatchObject({ reply: expect.stringContaining('valid public') });
    expect(await (await copilot('/shorten https://example.com/one https://example.com/two')).json()).toMatchObject({ reply: expect.stringContaining('more than one URL') });
    const destination = 'https://example.com/one?a=1';
    expect(await (await copilot('/shorten ' + destination)).json()).toMatchObject({ reply: expect.stringContaining('Saved to Short links') });
    const { links } = await (await owner('/api/links')).json() as { links: { slug: string; destination_url: string }[] };
    expect(links).toHaveLength(1);
    expect(links[0].destination_url).toBe(destination);
    expect((await fetch(base + '/s/' + links[0].slug, { redirect: 'manual' })).headers.get('Location')).toBe(destination);
  });
});

it('grounds chat suggestions in the sample Brain and imported views', async () => {
  const sample = client();
  expect((await sample('/api/auth/sample', { method: 'POST' })).status).toBe(200);
  const result = await sample('/api/brain/suggestions');
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({
    suggestions: expect.arrayContaining([
      expect.objectContaining({ id: 'brain', reason: expect.stringContaining('Brain recorded') }),
      expect.objectContaining({ id: 'video', reason: expect.stringContaining('recorded views') }),
    ]),
  });
});

describe('Creator workflows', () => {
  it('captures publication metrics, creates reusable placement links, and scopes projects and clips to their owner', async () => {
    const owner = client(), other = client();
    const { res } = await signup(owner);
    const { creator } = await res.json() as { creator: { id: string } };
    await signup(other);
    const project = (await (await owner('/api/studio/projects', {
      method: 'POST', json: { title: 'Arduino radio projects', brief: 'A first build.' },
    })).json() as { project: { id: string } }).project;
    const draft = 'Line one.\nShow the setup after the result.';
    const sourceDate = new Date(Date.now() - 7 * 86400000).toISOString();
    const recorded = new Date().toISOString();
    const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
    const prefix = 'workflow-' + uniq();
    const ids = [0, 1, 2, 3].map((n) => prefix + '-' + n);
    const rows = ids.map((id, index) => [
      id, creator.id, 'youtube', 'radio' + index, 'Arduino radio ' + index,
      JSON.stringify([{ start: 23.8, text: 'The Arduino radio is getting its signal from this antenna.' }]),
      'captions-manual', null, sourceDate, recorded, recorded, recorded
    ].map((value) => value === null ? String([800, 1000, 1500, 2500][index]) : quote(value)).join(','));
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'creatorbrain-db', '--local', '--persist-to', PERSIST, '--command', `
      INSERT INTO content_items(id,creator_id,platform,external_id,title,transcript,transcript_source,views,published_at,created_at,updated_at,analyzed_at)
      VALUES (${rows.join('),(')});
      INSERT INTO assets(id,project_id,creator_id,type,title,content,created_at,updated_at)
      VALUES (${[prefix + '-script', project.id, creator.id, 'short_script', 'Short script', draft, recorded, recorded].map(quote).join(',')});
      INSERT INTO nodes(id,creator_id,type,label,description,created_at,updated_at,content_item_id)
      VALUES (${[prefix + '-node', creator.id, 'Hook', 'Open with the test result', 'The video starts with a working signal.', recorded, recorded, ids[0]].map(quote).join(',')});
    `], { stdio: 'ignore' });

    const path = '/api/workflows/project/' + project.id;
    expect((await other(path + '/publication')).status).toBe(404);
    const attach = await owner(path + '/publication', { method: 'PUT', json: { contentId: ids[0] } });
    expect(attach.status).toBe(200);
    expect(await attach.json()).toMatchObject({
      video: { title: 'Arduino radio 0', snapshot: { views: 800 } },
      baseline: { median: 1500, uploads: 3 },
    });
    const options = await (await other('/api/workflows/publication-options')).json();
    expect(options).toEqual({ videos: [] });

    const kit = () => owner(path + '/link-kit', { method: 'POST', json: { destination: 'https://example.com/radio' } });
    const firstKit = await kit();
    expect(firstKit.status).toBe(200);
    const { links } = await firstKit.json() as { links: Array<{ placement: string; slug: string }> };
    expect(new Set(links.map(({ slug }) => slug)).size).toBe(3);
    expect(links.map(({ placement }) => placement).sort()).toEqual(['bio', 'description', 'pinned_comment']);
    expect(await (await kit()).json()).toEqual({ links });
    expect((await other(path + '/link-kit')).status).toBe(404);
    const alias = await fetch(base + '/s/' + links[0].slug, { redirect: 'manual' });
    expect(alias.headers.get('location')).toBe('https://example.com/radio');

    const clips = await owner('/api/workflows/clips?query=Arduino+radio');
    expect(clips.status).toBe(200);
    expect(await clips.json()).toMatchObject({ clips: expect.arrayContaining([
      expect.objectContaining({ start: 23, url: expect.stringContaining('&t=23s') }),
    ]) });
    expect(await (await other('/api/workflows/clips?query=Arduino+radio')).json()).toEqual({ clips: [] });

    const brain = await owner('/api/workflows/memory', { method: 'PUT', json: { state: 'preference', note: 'Speak in Roman Hindi.' } });
    expect(brain.status).toBe(200);
    expect(await (await owner('/api/workflows/memory')).json()).toMatchObject({
      controls: [expect.objectContaining({ state: 'preference', note: 'Speak in Roman Hindi.' })],
    });
    expect(await (await other('/api/workflows/memory')).json()).toMatchObject({ controls: [] });

    const memories = await (await owner('/api/workflows/memory')).json();
    expect(memories).toMatchObject({ findings: [
      expect.objectContaining({ label: 'Open with the test result', sources: [expect.objectContaining({ title: 'Arduino radio 0' })] }),
    ] });
    const correct = { method: 'PUT', json: { state: 'corrected', nodeId: prefix + '-node', note: 'Open with the working radio' } };
    expect((await other('/api/workflows/memory', correct)).status).toBe(404);
    expect((await owner('/api/workflows/memory', correct)).status).toBe(200);
    expect(await (await owner('/api/brain/graph')).json()).toMatchObject({ graph: { nodes: [
      expect.objectContaining({ label: 'Open with the working radio' }),
    ] } });
    expect((await owner('/api/workflows/memory', { method: 'PUT', json: { state: 'dismissed', nodeId: prefix + '-node' } })).status).toBe(200);
    expect(await (await owner('/api/brain/graph')).json()).toMatchObject({ graph: { nodes: [] } });

    const plan = await (await owner('/api/workflows/weekly-plan')).json() as { actions: { id: string }[] };
    expect(plan.actions.some((action) => action.id === 'review:' + project.id)).toBe(true);
    const snooze = await owner('/api/workflows/weekly-plan/snooze', { method: 'POST', json: { id: 'review:' + project.id } });
    expect(snooze.status).toBe(200);
    const nextPlan = await snooze.json() as { actions: { id: string }[] };
    expect(nextPlan.actions.some((action) => action.id === 'review:' + project.id)).toBe(false);

    const { workspaceDigest } = await import('../../src/worker/lib/workspace-results');
    const draftKey = await workspaceDigest([prefix + '-script', draft]);
    const edit = { method: 'PATCH', json: { type: 'short_script', line: 2, draftKey, replacement: 'Show the setup first.' } };
    expect((await other(path + '/script-line', edit)).status).toBe(404);
    expect((await owner(path + '/script-line', edit)).status).toBe(200);
    expect((await owner(path + '/script-line', edit)).status).toBe(409);
    expect(await (await owner('/api/studio/projects/' + project.id)).json()).toMatchObject({
      assets: [expect.objectContaining({ content: 'Line one.\nShow the setup first.' })],
    });

    const studio = (message: string) => owner('/api/studio/chat', { method: 'POST', json: { projectId: project.id, message } });
    expect(await (await studio('/publication')).json()).toMatchObject({ reply: expect.stringContaining('800 recorded views near day seven') });
    expect(await (await studio('/clips antenna')).json()).toMatchObject({ reply: expect.stringContaining('&t=23s') });
  }, 60_000);

  it('gates watchlist history by saved agent ownership and keeps sample writes blocked', async () => {
    const owner = client(), other = client(), sample = client();
    const { res } = await signup(owner);
    const { creator } = await res.json() as { creator: { id: string } };
    await signup(other);
    const created = await owner('/api/agents/saved', { method: 'POST', json: {
      kind: 'competitor', channel: '@test', name: 'Watch test uploads', focus: 'Study repair topics',
    } });
    const { agent } = await created.json() as { agent: { id: string } };
    const path = '/api/agents/saved/' + agent.id + '/watch';
    expect(await (await owner(path)).json()).toEqual({ review: null });
    expect((await other(path)).status).toBe(404);
    const channel = { channel: 'Repair videos', url: 'https://www.youtube.com/@test', outliers: [] };
    const prior = {
      ...channel, checkedAt: '2026-10-01T09:00:00Z',
      uploads: [{ id: 'old', title: 'Before', views: 300, url: 'https://www.youtube.com/watch?v=old', publishedAt: '2026-10-01T08:00:00Z' }],
    };
    const latest = {
      ...channel, checkedAt: new Date().toISOString(),
      uploads: [{ id: 'new', title: 'After', views: 900, url: 'https://www.youtube.com/watch?v=new', publishedAt: '2026-11-01T08:00:00Z' }, ...prior.uploads],
    };
    const fixture = [agent.id, creator.id, JSON.stringify(latest), JSON.stringify(prior)]
      .map((value) => "'" + value.replaceAll("'", "''") + "'").join(',');
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'creatorbrain-db', '--local', '--persist-to', PERSIST, '--command',
      'INSERT INTO competitor_watch_snapshots(agent_id,creator_id,current_json,previous_json) VALUES (' + fixture + ');',
    ], { stdio: 'ignore' });
    expect(await (await owner(path, { method: 'POST' })).json()).toMatchObject({ review: {
      previousCheckedAt: prior.checkedAt, newUploads: [expect.objectContaining({ title: 'After' })],
    } });

    await sample('/api/auth/sample', { method: 'POST' });
    expect((await sample('/api/workflows/memory', { method: 'PUT', json: { state: 'preference', note: 'Test' } })).status).toBe(403);
    expect((await sample('/api/workflows/weekly-plan')).status).toBe(200);
  });
});
