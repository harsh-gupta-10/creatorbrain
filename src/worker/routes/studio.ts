import { requestedAgent } from '../agents/saved';
import { Hono } from 'hono';
import { appendToThread, loadThread } from '../lib/chats';
import { draftLanguageRule } from '../lib/language';
import { creatorDna } from '../lib/dna';
import { amazonClientFor } from '../amazon/credentials';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import { runContentStudioAgent, runComplianceChecker } from '../agents/definitions/studioAndResearch';
import {
  planChat,
  conversationContext,
  compose,
  draftLabels,
  affiliateLookup,
  explicitAmazonProduct,
  channelEvidence,
} from '../agents/workspace';
import { StudioChatSchema, type Project, type ProjectAsset, type Product, type ShortLink } from '../../shared/types';
import { serializeShortLinkCache, shortLinkCacheTtl } from '../lib/short-link-cache';

export const studioRoutes = new Hono<AppEnv>();

// Get all projects for creator
studioRoutes.get('/projects', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const projects = await dbClient.getProjects(creator.id);
  return c.json({ projects });
});

// Create new project
studioRoutes.post('/projects', async (c) => {
  const creator = c.get('creator');

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
  const creator = c.get('creator');

  const projectId = c.req.param('id');
  const dbClient = new DBClient(c.env.DB);
  const { project, assets } = await dbClient.getProjectWithAssets(creator.id, projectId);

  if (!project) return c.json({ error: 'Project not found' }, 404);

  return c.json({ project, assets });
});

// Update project status / title
studioRoutes.patch('/projects/:id', async (c) => {
  const creator = c.get('creator');

  const projectId = c.req.param('id');
  const body = await c.req.json();
  const dbClient = new DBClient(c.env.DB);

  await dbClient.updateProject(creator.id, projectId, body);
  const { project } = await dbClient.getProjectWithAssets(creator.id, projectId);

  return c.json({ project });
});

// Direct edit asset content
studioRoutes.put('/assets/:id', async (c) => {
  const creator = c.get('creator');

  const assetId = c.req.param('id');
  const { content, title } = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT * FROM assets WHERE id = ? AND creator_id = ?')
    .bind(assetId, creator.id)
    .first<ProjectAsset>();

  if (!existing) return c.json({ error: 'Asset not found' }, 404);

  const now = new Date().toISOString();

  // Create new version in asset_versions
  const versionRes = await c.env.DB.prepare('SELECT count(*) as cnt FROM asset_versions WHERE asset_id = ?')
    .bind(assetId)
    .first<{ cnt: number }>();

  const nextVer = (versionRes?.cnt || 0) + 1;
  const versionId = `v_${assetId}_${nextVer}`;

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO asset_versions (id, asset_id, version_number, content, prompt_trigger, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(versionId, assetId, nextVer, content, 'Manual user edit', now),
    c.env.DB.prepare(
      'UPDATE assets SET content = ?, title = ?, current_version_id = ?, updated_at = ? WHERE id = ?'
    ).bind(content, title || existing.title, versionId, now, assetId),
  ]);

  return c.json({ success: true, versionId, nextVer });
});

/**
 * Interactive Studio Chat (Headline Feature!)
 * Product Researcher + Studio Agent + Link Agent + Compliance Checker
 */
studioRoutes.post('/chat', async (c) => {
  const creator = c.get('creator');

  const body = await c.req.json();
  const parsed = StudioChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, 400);
  }

  const { projectId, message, productAsin } = parsed.data;
  const dbClient = new DBClient(c.env.DB);
  const router = new AIRouter(c.env);

  const { project, assets } = await dbClient.getProjectWithAssets(creator.id, projectId);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const history = await loadThread(c.env.DB, creator.id, `studio:${projectId}`, 6);
  const context = conversationContext(history, project);
  const report = await requestedAgent(c.env, creator, message, context);
  if (report) {
    await appendToThread(c.env.DB, creator.id, `studio:${projectId}`, [
      { role: 'user', content: message },
      { role: 'assistant', content: report },
    ]);
    return c.json({ reply: report, project, assets, product: null, shortLink: null });
  }
  const plan = productAsin
    ? { action: 'link' as const, product: productAsin }
    : await planChat(router, creator.id, message, context);
  const attached = project.primary_product_id
    ? await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND creator_id = ?')
        .bind(project.primary_product_id, creator.id)
        .first<Product>()
    : null;
  const query =
    plan.product || attached?.product_url || explicitAmazonProduct(project.brief || '') ||
    explicitAmazonProduct(project.title) || project.title;
  if (plan.action !== 'bundle') {
    const lookup = plan.action === 'link' || plan.product ? await affiliateLookup(c.env, creator.id, query) : null;
    const match = lookup?.matches.length === 1 ? lookup.matches[0] : null;
    if (match) {
      const product = { ...match, id: `prod_${creator.id}_${new URL(match.product_url).hostname.replace(/^www\./, '')}_${match.asin}` };
      await dbClient.saveProduct(product);
      await dbClient.updateProject(creator.id, projectId, { primary_product_id: product.id });
    }
    const type = plan.action;
    const previous = assets.find((a) => a.type === type);
    const source = [
      previous?.content.slice(0, 8000),
      type === 'compliance_report' ? assets.find((a) => a.type === 'description')?.content : '',
      lookup?.reply,
    ]
      .filter(Boolean)
      .join('\n');
    const reply =
      type === 'link' ? lookup!.reply : await compose(c.env, creator, router, message, context, type, source);
    const updatedAsset = type === 'chat' || type === 'link' ? undefined : type;
    if (updatedAsset) {
      await c.env.DB.batch(
        versionedDraft(
          c.env.DB,
          creator.id,
          projectId,
          previous?.id || `asset_${projectId}_${updatedAsset}`,
          updatedAsset,
          draftLabels[updatedAsset],
          reply,
          message
        )
      );
    }
    await appendToThread(c.env.DB, creator.id, `studio:${projectId}`, [
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]);
    return c.json({
      reply,
      updatedAsset,
      product: match,
      shortLink: null,
      ...(await dbClient.getProjectWithAssets(creator.id, projectId)),
    });
  }

  const dna = creatorDna(creator);
  const amazon = await amazonClientFor(c.env.DB, c.env, creator.id);
  const amazonClient = amazon;
  const product = attached && !attached.is_mock ? attached : null;
  // Step 2: Content Studio Agent generates or refines all assets
  const generated = await runContentStudioAgent({
    amazon,
    languageRule: draftLanguageRule(creator),
    usesAmazon: !!amazon.getPartnerTag(),
    creatorId: creator.id,
    projectId,
    brief: JSON.stringify({
      context,
      request: message,
      evidence: await channelEvidence(c.env.DB, creator.id, project.title),
    }),
    product,
    dna,
    router,
    db: c.env.DB,
  });

  // Step 3: Link Agent creates tracked Amazon affiliate link + short link + bio block
  let shortSlug = '';
  let taggedUrl = '';
  if (product && amazon.getPartnerTag()) {
    taggedUrl = amazonClient.buildAffiliateUrl(product.product_url);
    shortSlug = `${product.asin.toLowerCase()}-${Math.random().toString(36).slice(2, 5)}`;

    const shortLink: ShortLink = {
      id: `link_${Date.now()}_${shortSlug}`,
      creator_id: creator.id,
      slug: shortSlug,
      destination_url: taggedUrl,
      destination_domain: amazon.getMarketplace(),
      title: `${product.title.slice(0, 50)} (Project Deal)`,
      utm_source: 'youtube',
      utm_medium: 'description',
      utm_campaign: project.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 30),
      total_clicks: 0,
      created_at: new Date().toISOString(),
    };

    await dbClient.createShortLink(shortLink);
    const cacheTtl = shortLinkCacheTtl(shortLink.expires_at);
    if (c.env.KV && cacheTtl) {
      await c.env.KV.put(`link:${shortSlug}`, serializeShortLinkCache(shortLink), { expirationTtl: cacheTtl });
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
    {
      type: 'thumbnail_ideas' as const,
      title: '3-Word Thumbnail Concepts & Prompts',
      content: generated.thumbnailIdeas,
    },
    { type: 'community_post' as const, title: 'YouTube Community Tab Poll', content: generated.communityPost },
    {
      type: 'compliance_report' as const,
      title: 'Compliance Audit Report',
      content: `STATUS: ${compliance.passed ? 'No issues flagged by these checks' : 'ATTENTION REQUIRED'}
Disclosure Present: ${compliance.disclosureFound ? 'YES' : 'NO'}
Price Timestamp Present: ${compliance.priceTimestampFound ? 'YES' : 'NO'}
Flags: ${compliance.flags.length === 0 ? 'None flagged.' : compliance.flags.join('\n- ')}`,
    },
  ];

  await c.env.DB.batch(
    assetTypes.flatMap((asset) =>
      versionedDraft(
        c.env.DB,
        creator.id,
        projectId,
        assets.find((existing) => existing.type === asset.type)?.id || `asset_${projectId}_${asset.type}`,
        asset.type,
        asset.title,
        asset.content,
        message
      )
    )
  );

  // Reload updated assets
  const updatedData = await dbClient.getProjectWithAssets(creator.id, projectId);

  const origin = new URL(c.req.url).origin;
  const shortUrl = shortSlug ? `${origin}/s/${shortSlug}` : null;
  const reply = [
    product ? `Researched ${product.title}.` : null,
    'Drafted titles, script outline, description, pinned comment, captions and thumbnail ideas from your Creator DNA.',
    shortUrl ? `Tracked link: ${shortUrl}.` : null,
    'Compliance check done.',
  ]
    .filter(Boolean)
    .join(' ');

  await appendToThread(c.env.DB, creator.id, `studio:${projectId}`, [
    { role: 'user', content: message },
    {
      role: 'assistant',
      content: reply,
      meta: { product: product ? { title: product.title, asin: product.asin } : null, shortLink: shortUrl },
    },
  ]);

  return c.json({
    reply,
    product,
    shortLink: shortUrl,
    compliance,
    assets: updatedData.assets,
    project: updatedData.project,
  });
});

function versionedDraft(
  db: D1Database,
  creatorId: string,
  projectId: string,
  id: string,
  type: ProjectAsset['type'],
  title: string,
  content: string,
  message: string
) {
  const version = crypto.randomUUID();
  const now = new Date().toISOString();
  return [
    db
      .prepare(
        `INSERT INTO assets (id, project_id, creator_id, type, title, content, current_version_id, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content, current_version_id=excluded.current_version_id, updated_at=excluded.updated_at`
      )
      .bind(id, projectId, creatorId, type, title, content, version, now, now),
    db
      .prepare(
        `INSERT INTO asset_versions (id, asset_id, version_number, content, prompt_trigger, created_at)
          SELECT ?, ?, COALESCE(MAX(version_number),0)+1, ?, ?, ? FROM asset_versions WHERE asset_id=?`
      )
      .bind(version, id, content, message, now, id),
  ];
}
