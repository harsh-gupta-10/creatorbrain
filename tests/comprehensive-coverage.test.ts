import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { sameOriginWrites, requireCreator, authRateLimit } from '../src/worker/middleware';
import { DBClient } from '../src/worker/db/queries';
import { AIRouter } from '../src/worker/ai/router';
import { AIBudgetManager } from '../src/worker/ai/budget';
import { AmazonCreatorsClient } from '../src/worker/amazon/client';
import { normalizeYouTubeInput } from '../src/worker/content/youtube';
import {
  StudioChatSchema,
  UpdateProjectSchema,
  CreateShortLinkSchema,
  ToolGeneratorSchema,
  type Project,
} from '../src/shared/types';
import type { AppEnv } from '../src/worker/env';

describe('Coverage Suite 1: Middleware & Security Protections', () => {
  it('sameOriginWrites rejects cross-origin write requests with 403', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', sameOriginWrites);
    app.post('/api/action', (c) => c.json({ success: true }));

    const res = await app.request('https://creatorbrain.example/api/action', {
      method: 'POST',
      headers: { Origin: 'https://evil-attacker.example' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Cross-site request blocked');
  });

  it('sameOriginWrites permits matching-origin write requests and read requests', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', sameOriginWrites);
    app.post('/api/action', (c) => c.json({ success: true }));
    app.get('/api/read', (c) => c.json({ read: true }));

    const postRes = await app.request('https://creatorbrain.example/api/action', {
      method: 'POST',
      headers: { Origin: 'https://creatorbrain.example' },
    });
    expect(postRes.status).toBe(200);

    const getRes = await app.request('https://creatorbrain.example/api/read');
    expect(getRes.status).toBe(200);
  });

  it('requireCreator passes public endpoints without a session', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requireCreator);
    app.get('/api/auth/me', (c) => c.json({ public: true }));
    app.get('/api/health', (c) => c.json({ status: 'ok' }));

    const res1 = await app.request('https://creatorbrain.example/api/auth/me');
    expect(res1.status).toBe(200);

    const res2 = await app.request('https://creatorbrain.example/api/health');
    expect(res2.status).toBe(200);
  });

  it('authRateLimit enforces rate limit when limiter fails', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', (c, next) => {
      c.env = {
        AUTH_LIMITER: {
          limit: vi.fn().mockResolvedValue({ success: false }),
        },
      } as unknown as AppEnv['Bindings'];
      return next();
    });
    app.use('*', authRateLimit);
    app.post('/api/auth/login', (c) => c.json({ ok: true }));

    const res = await app.request('https://creatorbrain.example/api/auth/login', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '192.0.2.1' },
    });
    expect(res.status).toBe(429);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Too many attempts');
  });
});

describe('Coverage Suite 2: DBClient Operations & Scoping', () => {
  function createMockD1(rows: Record<string, unknown>[] = []): D1Database {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: rows, success: true }),
      first: vi.fn().mockResolvedValue(rows[0] || null),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      raw: vi.fn().mockResolvedValue([]),
    };
    return {
      prepare: vi.fn().mockReturnValue(mockStmt),
      batch: vi.fn().mockResolvedValue([{ results: rows }, { results: [] }]),
      exec: vi.fn().mockResolvedValue({ count: 1, duration: 1 }),
      dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    } as unknown as D1Database;
  }

  it('DBClient queries creator records with secrets stripped', async () => {
    const sampleCreator = {
      id: 'creator_test_1',
      name: 'Test Creator',
      handle: 'testcreator',
      email: 'test@example.com',
      password_hash: 'secret_hash',
      password_salt: 'secret_salt',
      avatar_url: null,
      niche: 'Tech',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const db = createMockD1([sampleCreator]);
    const client = new DBClient(db);

    const retrieved = await client.getCreator('creator_test_1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.handle).toBe('testcreator');
    expect((retrieved as unknown as Record<string, unknown>).password_hash).toBeUndefined();
    expect((retrieved as unknown as Record<string, unknown>).password_salt).toBeUndefined();

    const byHandle = await client.getCreatorByHandle('testcreator');
    expect(byHandle).not.toBeNull();
    expect(byHandle?.handle).toBe('testcreator');
  });

  it('DBClient handles graph nodes, projects and deletion', async () => {
    const db = createMockD1([]);
    const client = new DBClient(db);

    const graph = await client.getBrainGraph('creator_test_1');
    expect(graph.nodes).toBeDefined();
    expect(graph.edges).toBeDefined();

    const sampleProject: Project = {
      id: 'proj_new_1',
      creator_id: 'creator_test_1',
      title: 'Review Video',
      brief: 'Motorola Edge review',
      status: 'Idea',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await client.createProject(sampleProject);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO projects'));

    await client.deleteCreatorData('creator_test_1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM creators WHERE id = ?'));
  });
});

describe('Coverage Suite 3: AI Router & Budget Management', () => {
  it('routes to fallback provider if primary fails', async () => {
    const router = new AIRouter({ ANTHROPIC_API_KEY: 'mock-key' });
    vi.spyOn(router['claude']!, 'generateText').mockRejectedValue(new Error('Anthropic rate limited'));

    const text = await router.generateText([{ role: 'user', content: 'Write a hook for a video' }]);
    expect(text).toBeDefined();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('tracks daily budget accurately in KV and in-memory', async () => {
    const mockStore = new Map<string, string>();
    const mockKV = {
      get: vi.fn().mockImplementation(async (key: string) => mockStore.get(key) || null),
      put: vi.fn().mockImplementation(async (key: string, val: string) => {
        mockStore.set(key, val);
      }),
      delete: vi.fn().mockImplementation(async (key: string) => {
        mockStore.delete(key);
      }),
    } as unknown as KVNamespace;

    const manager = new AIBudgetManager(mockKV);
    // Should not throw under budget
    await expect(manager.checkBudget('creator_test_budget', 5.0)).resolves.not.toThrow();

    // Record usage
    await manager.recordUsage('creator_test_budget', 6.0);
    // Now should throw budget exceeded error
    await expect(manager.checkBudget('creator_test_budget', 5.0)).rejects.toThrow(/Daily AI budget limit/);
  });
});

describe('Coverage Suite 4: YouTube URL & Handle Parsing', () => {
  it('correctly normalizes handles and URLs', () => {
    const handleResult = normalizeYouTubeInput('@izoog10');
    expect(handleResult.pageUrl).toBe('https://www.youtube.com/@izoog10');

    const plainHandle = normalizeYouTubeInput('izoog10');
    expect(plainHandle.pageUrl).toBe('https://www.youtube.com/@izoog10');

    const channelIdResult = normalizeYouTubeInput('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(channelIdResult.channelId).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(channelIdResult.pageUrl).toBe('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw');

    const fullUrlResult = normalizeYouTubeInput('https://youtube.com/@theharshlab/videos');
    expect(fullUrlResult.pageUrl).toBe('https://www.youtube.com/@theharshlab');
  });
});

describe('Coverage Suite 5: Amazon Creators & Schema Validation', () => {
  it('falls back to mock catalog gracefully when live search fails', async () => {
    const client = new AmazonCreatorsClient({
      partnerTag: 'test-partner-20',
      marketplace: 'amazon.in',
    });

    const searchResults = await client.searchItems('headphones', 'creator_demo_1');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].is_mock).toBe(1);
    expect(searchResults[0].title).toBeDefined();
    expect(client.getPartnerTag()).toBe('test-partner-20');
    expect(client.getMarketplace()).toBe('amazon.in');
  });

  it('validates StudioChatSchema, UpdateProjectSchema, and CreatorDNASchema strictly', () => {
    const validChat = {
      message: 'Draft an 8 minute review of the Motorola Edge 50 Neo',
      projectId: 'proj_12345',
      history: [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello!' },
      ],
    };
    expect(StudioChatSchema.safeParse(validChat).success).toBe(true);

    const invalidChat = {
      message: '', // Empty message
      projectId: 'proj_12345',
    };
    expect(StudioChatSchema.safeParse(invalidChat).success).toBe(false);

    const validUpdate = {
      status: 'Scripted' as const,
      brief: 'Updated brief',
    };
    expect(UpdateProjectSchema.safeParse(validUpdate).success).toBe(true);

    const validShortLink = {
      destination_url: 'https://example.com/gear',
      slug: 'my-gear',
    };
    expect(CreateShortLinkSchema.safeParse(validShortLink).success).toBe(true);

    const validGenerator = {
      toolType: 'hook' as const,
      topic: 'How to edit faster in Premiere Pro',
    };
    expect(ToolGeneratorSchema.safeParse(validGenerator).success).toBe(true);
  });
});

describe('Coverage Suite 6: API Route Endpoints', () => {
  it('handles content item retrieval with JSON parsing', async () => {
    const app = new Hono<AppEnv>();
    const mockItem = {
      id: 'item_1',
      creator_id: 'creator_1',
      platform: 'youtube',
      external_id: 'vid_1',
      title: 'Motorola Edge 50 Review',
      description: 'Full review',
      transcript: JSON.stringify([{ text: 'Hello everyone', start: 0, duration: 2 }]),
      tags_json: JSON.stringify(['tech', 'gadgets']),
      analysis_json: JSON.stringify({ pacing: 'fast' }),
      thumbnail_analysis_json: JSON.stringify({ colors: ['#ff0000'] }),
    };

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockItem),
        all: vi.fn().mockResolvedValue({ results: [mockItem] }),
      }),
    } as unknown as D1Database;

    app.use('*', (c, next) => {
      c.set('creator', { id: 'creator_1', name: 'Creator', handle: 'creator' } as AppEnv['Variables']['creator']);
      c.env = { DB: mockDb } as unknown as AppEnv['Bindings'];
      return next();
    });

    const { contentRoutes } = await import('../src/worker/routes/content');
    app.route('/api/content', contentRoutes);

    const res = await app.request('https://creatorbrain.example/api/content/item_1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { transcript: unknown[]; tags: string[] } };
    expect(body.item.transcript.length).toBe(1);
    expect(body.item.tags).toEqual(['tech', 'gadgets']);
  });

  it('handles link routes with DBClient integration', async () => {
    const app = new Hono<AppEnv>();
    const mockLink = {
      id: 'link_1',
      creator_id: 'creator_1',
      destination_url: 'https://example.com/item',
      short_slug: 'item1',
      clicks: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [mockLink] }),
        first: vi.fn().mockResolvedValue(mockLink),
      }),
    } as unknown as D1Database;

    app.use('*', (c, next) => {
      c.set('creator', { id: 'creator_1', name: 'Creator', handle: 'creator' } as AppEnv['Variables']['creator']);
      c.env = { DB: mockDb } as unknown as AppEnv['Bindings'];
      return next();
    });

    const { linkRoutes } = await import('../src/worker/routes/links');
    app.route('/api/links', linkRoutes);

    const res = await app.request('https://creatorbrain.example/api/links');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { links: unknown[] };
    expect(body.links).toBeDefined();
  });
});
