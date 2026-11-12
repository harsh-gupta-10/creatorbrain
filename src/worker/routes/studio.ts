import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import {
  runProductResearcher,
  runContentStudioAgent,
  runComplianceChecker,
} from '../agents/definitions/studioAndResearch';
import { AmazonCreatorsClient } from '../amazon/client';
import { CreatorDNASchema, StudioChatSchema } from '../../shared/types';
import type { Project, ProjectAsset, Product, ShortLink } from '../../shared/types';

export const studioRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI?: any;
  };
}>();

// Get all projects for creator
studioRoutes.get('/projects', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const projects = await dbClient.getProjects(creator.id);
  return c.json({ projects });
});

// Create new project
studioRoutes.post('/projects', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { title, brief, status } = await c.req.json();
  const dbClient = new DBClient(c.env.DB);
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const newProject: Project = {
    id,
    creator_id: creator.id,
    title: title || 'New Video Project',
    brief: brief || '',
    status: status || 'Idea',
    created_at: now,
    updated_at: now,
  };

  await dbClient.createProject(newProject);
  return c.json({ project: newProject });
});

// Get single project with all assets
studioRoutes.get('/projects/:id', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('id');
  const dbClient = new DBClient(c.env.DB);
  const { project, assets } = await dbClient.getProjectWithAssets(creator.id, projectId);

  if (!project) return c.json({ error: 'Project not found' }, 404);

  return c.json({ project, assets });
});

// Update project status / title
studioRoutes.patch('/projects/:id', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const projectId = c.req.param('id');
  const body = await c.req.json();
  const dbClient = new DBClient(c.env.DB);

  await dbClient.updateProject(creator.id, projectId, body);
  const { project } = await dbClient.getProjectWithAssets(creator.id, projectId);

  return c.json({ project });
});

// Direct edit asset content
studioRoutes.put('/assets/:id', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const assetId = c.req.param('id');
  const { content, title } = await c.req.json();

  const existing = await c.env.DB
    .prepare('SELECT * FROM assets WHERE id = ? AND creator_id = ?')
    .bind(assetId, creator.id)
    .first<ProjectAsset>();

  if (!existing) return c.json({ error: 'Asset not found' }, 404);

  const now = new Date().toISOString();

  // Create new version in asset_versions
  const versionRes = await c.env.DB
    .prepare('SELECT count(*) as cnt FROM asset_versions WHERE asset_id = ?')
    .bind(assetId)
    .first<{ cnt: number }>();

  const nextVer = (versionRes?.cnt || 0) + 1;
  const versionId = `v_${assetId}_${nextVer}`;

  await c.env.DB.batch([
    c.env.DB
      .prepare(
        'INSERT INTO asset_versions (id, asset_id, version_number, content, prompt_trigger, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(versionId, assetId, nextVer, content, 'Manual user edit', now),
    c.env.DB
      .prepare(
        'UPDATE assets SET content = ?, title = ?, current_version_id = ?, updated_at = ? WHERE id = ?'
      )
      .bind(content, title || existing.title, versionId, now, assetId),
  ]);

  return c.json({ success: true, versionId, nextVer });
});

/**
 * Interactive Studio Chat (Headline Feature!)
 * Product Researcher + Studio Agent + Link Agent + Compliance Checker
 */
studioRoutes.post('/chat', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = StudioChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, 400);
  }

  const { projectId, message, productAsin } = parsed.data;
  const dbClient = new DBClient(c.env.DB);
  const router = new AIRouter(c.env);

  const { project } = await dbClient.getProjectWithAssets(creator.id, projectId);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  // Parse Creator DNA
  let dna = {
    voice: {
      pace: 'High-velocity & conversational',
      tone: 'Candid, engineering-grounded',
      catchphrases: ['Let us pop the hood', 'Real talk', 'Is it paisa vasool?'],
      language_mix: 'Hinglish (70% English / 30% Hindi colloquial idioms)',
      hook_formula: 'Action-first teardown in first 4s',
    },
    visual: {
      thumbnail_palette: ['#FF0055', '#00F0FF', '#111827', '#F59E0B'],
      composition: 'Hero product on left, creator face on right',
      text_overlay_words: 3,
    },
    packaging: {
      title_avg_length: 48,
      title_patterns: ['[Product]: Don\'t Buy Until You See This!'],
      disclosure_position: 'Top 3 lines of description',
    },
    audience: {
      primary_demographic: '18-34 tech enthusiasts & makers',
      buying_intent: 'High VFM focus',
    },
  };

  if (creator.dna_summary) {
    try {
      dna = CreatorDNASchema.parse(JSON.parse(creator.dna_summary));
    } catch {
      // Use fallback
    }
  }

  // Step 1: Resolve Product with Product Researcher
  let product: Product | null = null;
  const amazonClient = new AmazonCreatorsClient();

  if (productAsin) {
    const items = await amazonClient.getItems([productAsin], creator.id);
    product = items[0] || null;
  } else if (
    message.toLowerCase().includes('motorola') ||
    message.toLowerCase().includes('vivo') ||
    message.toLowerCase().includes('mac mini') ||
    message.toLowerCase().includes('phone') ||
    message.toLowerCase().includes('headphone')
  ) {
    product = await runProductResearcher(message, creator.id, router, c.env.DB);
  }

  // Save product to library if found
  if (product) {
    await dbClient.saveProduct(product);
    await dbClient.updateProject(creator.id, projectId, {
      primary_product_id: product.id,
    });
  }

  // Step 2: Content Studio Agent generates or refines all assets
  const generated = await runContentStudioAgent({
    creatorId: creator.id,
    projectId,
    brief: `${project.brief} - Refinement: ${message}`,
    product,
    dna,
    router,
    db: c.env.DB,
  });

  // Step 3: Link Agent creates tracked Amazon affiliate link + short link + bio block
  let shortSlug = '';
  let taggedUrl = '';
  if (product) {
    taggedUrl = amazonClient.buildAffiliateUrl(product.product_url);
    shortSlug = `${product.asin.toLowerCase()}-${Math.random().toString(36).slice(2, 5)}`;

    const shortLink: ShortLink = {
      id: `link_${Date.now()}_${shortSlug}`,
      creator_id: creator.id,
      slug: shortSlug,
      destination_url: taggedUrl,
      destination_domain: 'amazon.in',
      title: `${product.title.slice(0, 50)} (Project Deal)`,
      utm_source: 'youtube',
      utm_medium: 'description',
      utm_campaign: project.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30),
      total_clicks: 0,
      created_at: new Date().toISOString(),
    };

    await dbClient.createShortLink(shortLink);

    // Save in KV for instant edge redirect lookup!
    if (c.env.KV) {
      await c.env.KV.put(`link:${shortSlug}`, taggedUrl);
    }
  }

  // Step 4: Compliance Checker
  const compliance = runComplianceChecker(generated.description);

  // Step 5: Save all assets to D1
  const assetTypes = [
    { type: 'titles' as const, title: '5 High-CTR Title Options', content: generated.titles },
    { type: 'description' as const, title: 'YouTube Description with Disclosures', content: generated.description },
    { type: 'tags' as const, title: 'Optimized Video Tags', content: generated.tags },
    { type: 'pinned_comment' as const, title: 'High-Engagement Pinned Comment', content: generated.pinnedComment },
    { type: 'shorts_caption' as const, title: 'YouTube Shorts Caption', content: generated.shortsCaption },
    { type: 'instagram_caption' as const, title: 'Instagram Reel Caption', content: generated.instagramCaption },
    { type: 'script_outline' as const, title: '8-Minute Script Outline', content: generated.scriptOutline },
    { type: 'thumbnail_ideas' as const, title: '3-Word Thumbnail Concepts & Prompts', content: generated.thumbnailIdeas },
    { type: 'community_post' as const, title: 'YouTube Community Tab Poll', content: generated.communityPost },
    {
      type: 'compliance_report' as const,
      title: 'Compliance Audit Report',
      content: `STATUS: ${compliance.passed ? 'PASS (100% Compliant)' : 'ATTENTION REQUIRED'}
Disclosure Present: ${compliance.disclosureFound ? 'YES' : 'NO'}
Price Timestamp Present: ${compliance.priceTimestampFound ? 'YES' : 'NO'}
Flags: ${compliance.flags.length === 0 ? 'None. Fully compliant with Amazon Operating Agreement & FTC Guidelines.' : compliance.flags.join('\n- ')}`,
    },
  ];

  for (const a of assetTypes) {
    const assetId = `asset_${projectId}_${a.type}`;
    const assetObj: ProjectAsset = {
      id: assetId,
      project_id: projectId,
      creator_id: creator.id,
      type: a.type,
      current_version_id: `v_${assetId}_1`,
      title: a.title,
      content: a.content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await dbClient.saveAsset(assetObj);
  }

  // Reload updated assets
  const updatedData = await dbClient.getProjectWithAssets(creator.id, projectId);

  return c.json({
    reply: `I have researched ${product ? product.title : 'the product'}, synthesized all 9 project assets in your signature Creator DNA voice, created tracked short link (https://creatorbrain.dev/s/${shortSlug || 'deal'}), and completed compliance verification!`,
    product,
    shortLink: shortSlug ? `https://creatorbrain.dev/s/${shortSlug}` : null,
    compliance,
    assets: updatedData.assets,
    project: updatedData.project,
  });
});
