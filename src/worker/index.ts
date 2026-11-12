import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { onboardingRoutes } from './routes/onboarding';
import { studioRoutes } from './routes/studio';
import { bioRoutes } from './routes/bio';
import { linkRoutes } from './routes/links';
import { amazonRoutes } from './routes/amazon';
import { brainRoutes } from './routes/brain';
import { learnRoutes } from './routes/learn';
import { assessRoutes } from './routes/assess';
import { toolsRoutes } from './routes/tools';
import { agentsRoutes } from './routes/agents';
import { settingsRoutes } from './routes/settings';
import { DBClient } from './db/queries';
import { runOrchestrator, runMemoryCurator } from './agents/definitions/tutorAndCurriculum';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS?: Fetcher;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_FAST_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GEMINI_API_KEY?: string;
  AI?: any;
  ENCRYPTION_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for API routes
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Mount API route groups
app.route('/api/auth', authRoutes);
app.route('/api/onboarding', onboardingRoutes);
app.route('/api/studio', studioRoutes);
app.route('/api/bio', bioRoutes);
app.route('/api/links', linkRoutes);
app.route('/api/amazon', amazonRoutes);
app.route('/api/brain', brainRoutes);
app.route('/api/learn', learnRoutes);
app.route('/api/assess', assessRoutes);
app.route('/api/tools', toolsRoutes);
app.route('/api/agents', agentsRoutes);
app.route('/api/settings', settingsRoutes);

// ==========================================
// SHORT LINK TRANSPARENT REDIRECT (/s/:slug)
// ==========================================
app.get('/s/:slug', async (c) => {
  const slug = c.req.param('slug');
  let destinationUrl = '';

  // 1. Fast KV Lookup
  if (c.env.KV) {
    const cached = await c.env.KV.get(`link:${slug}`);
    if (cached) destinationUrl = cached;
  }

  // 2. Fallback to D1 source of truth
  const dbClient = new DBClient(c.env.DB);
  const link = await dbClient.getShortLinkBySlug(slug);

  if (!link && !destinationUrl) {
    return c.html(
      `<!DOCTYPE html>
<html>
<head><title>Link Not Found - CreatorBrain</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center}a{color:#06b6d4;text-decoration:none}</style></head>
<body>
  <div>
    <h1 style="font-size:2.5rem;margin-bottom:8px">404</h1>
    <p style="color:#94a3b8;font-size:1.1rem">This short link does not exist or has expired.</p>
    <p><a href="/">Return to CreatorBrain</a></p>
  </div>
</body>
</html>`,
      404
    );
  }

  const target = destinationUrl || link!.destination_url;

  // 3. Record click analytics via waitUntil (zero latency penalty)
  if (link) {
    const cf = (c.req.raw as any).cf || {};
    const country = cf.country || 'India';
    const userAgent = c.req.header('user-agent') || '';
    const device = /mobile/i.test(userAgent) ? 'Mobile' : 'Desktop';
    const referrer = c.req.header('referer') || 'Direct';

    const clickPromise = dbClient.recordClick(link.id, link.creator_id, {
      country,
      device,
      referrer,
      userAgent,
    });

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(clickPromise);
    } else {
      await clickPromise;
    }
  }

  // 4. Transparent 302 redirect
  return c.redirect(target, 302);
});

// ==========================================
// PUBLIC LINK-IN-BIO PAGE (/@:handle)
// ==========================================
const handleBioPage = async (c: any) => {
  const rawHandle = c.req.param('handle') || c.req.path.replace(/^\/(?:@|%40)/, '');
  if (!rawHandle) return c.text('Not found', 404);
  const handle = decodeURIComponent(rawHandle).toLowerCase();
  const dbClient = new DBClient(c.env.DB);
  const { creator, bioPage, blocks } = await dbClient.getBioPageWithBlocks(handle);

  if (!creator || !bioPage) {
    return c.html(
      `<!DOCTYPE html>
<html>
<head><title>Creator Not Found - CreatorBrain</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:system-ui;background:#090d16;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}a{color:#06b6d4}</style></head>
<body>
  <div>
    <h2>Creator @${handle} Not Found</h2>
    <p><a href="/">Explore CreatorBrain</a></p>
  </div>
</body>
</html>`,
      404
    );
  }

  // Theme palettes
  const themeBg = bioPage.bg_color || '#090d16';
  const themeAccent = bioPage.accent_color || '#06b6d4';

  const renderedBlocks = blocks
    .filter((b) => b.is_active)
    .map((b) => {
      if (b.type === 'product_card' && b.product) {
        const prod = b.product;
        return `
        <div class="bio-card" onclick="trackClick('${b.id}', '${b.url || prod.product_url}')">
          <div class="card-inner">
            <img src="${prod.image_url}" alt="${prod.title}" class="prod-img" />
            <div class="prod-info">
              <span class="badge">Amazon Deal</span>
              <h3 class="prod-title">${prod.title}</h3>
              <p class="prod-price">${prod.price_str} <span class="price-as-of">(${prod.price_timestamp})</span></p>
            </div>
            <a href="${b.url || prod.product_url}" target="_blank" rel="noopener noreferrer" class="btn-buy">
              Buy on Amazon
            </a>
          </div>
        </div>`;
      }

      if (b.type === 'link') {
        return `
        <a href="${b.url || '#'}" target="_blank" rel="noopener noreferrer" class="bio-link" onclick="trackClick('${b.id}', '${b.url}')">
          <span>${b.title || 'Link'}</span>
          <span class="arrow">→</span>
        </a>`;
      }

      if (b.type === 'social_links') {
        let socials: Record<string, string> = {};
        try {
          socials = b.content_json ? JSON.parse(b.content_json) : {};
        } catch {
          // ignore
        }
        const socialItems = Object.entries(socials)
          .map(
            ([platform, url]) =>
              `<a href="${url}" target="_blank" rel="noopener" class="social-btn">${platform.toUpperCase()}</a>`
          )
          .join('');
        return `<div class="social-row">${socialItems}</div>`;
      }

      if (b.type === 'text') {
        let textContent = b.title || '';
        try {
          const parsed = b.content_json ? JSON.parse(b.content_json) : null;
          if (parsed?.text) textContent = parsed.text;
        } catch {
          // ignore
        }
        return `<div class="text-block">${textContent}</div>`;
      }

      if (b.type === 'divider') {
        return `<hr class="bio-divider" />`;
      }

      return '';
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bioPage.custom_title || creator.name} | CreatorBrain Bio</title>
  <meta name="description" content="${bioPage.custom_bio || creator.bio || ''}">
  <style>
    :root {
      --bg: ${themeBg};
      --accent: ${themeAccent};
      --text: #f8fafc;
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 16px;
      line-height: 1.5;
    }
    .container {
      width: 100%;
      max-width: 580px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .avatar {
      width: 96px;
      height: 96px;
      border-radius: 9999px;
      border: 3px solid var(--accent);
      object-fit: cover;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .creator-name {
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      margin-top: 8px;
    }
    .handle {
      font-size: 0.95rem;
      color: var(--accent);
      font-weight: 500;
    }
    .creator-bio {
      font-size: 0.95rem;
      color: #94a3b8;
      text-align: center;
      margin-bottom: 12px;
    }
    .bio-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 16px 20px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    }
    .bio-link:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .bio-card {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 16px;
      backdrop-filter: blur(8px);
      transition: all 0.2s;
    }
    .bio-card:hover {
      border-color: var(--accent);
    }
    .card-inner {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .prod-img {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      object-fit: cover;
      background: #000;
      flex-shrink: 0;
    }
    .prod-info {
      flex: 1;
      min-width: 0;
    }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--accent);
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .prod-title {
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .prod-price {
      font-size: 0.95rem;
      font-weight: 700;
      color: #10b981;
    }
    .price-as-of {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 400;
    }
    .btn-buy {
      padding: 8px 14px;
      background: var(--accent);
      color: #000;
      font-weight: 700;
      font-size: 0.85rem;
      border-radius: 8px;
      text-decoration: none;
      flex-shrink: 0;
      transition: opacity 0.2s;
    }
    .btn-buy:hover { opacity: 0.9; }
    .social-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
      width: 100%;
      margin: 8px 0;
    }
    .social-btn {
      padding: 8px 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      font-size: 0.8rem;
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s;
    }
    .social-btn:hover {
      background: var(--accent);
      color: #000;
    }
    .text-block {
      font-size: 0.85rem;
      color: #94a3b8;
      text-align: center;
      padding: 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      width: 100%;
    }
    .bio-divider {
      width: 100%;
      border: none;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 8px 0;
    }
    .footer {
      margin-top: 32px;
      font-size: 0.8rem;
      color: #64748b;
      text-align: center;
    }
    .footer a { color: var(--accent); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <img src="${creator.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}" alt="${creator.name}" class="avatar" />
    <h1 class="creator-name">${bioPage.custom_title || creator.name}</h1>
    <div class="handle">@${creator.handle}</div>
    <p class="creator-bio">${bioPage.custom_bio || creator.bio || ''}</p>

    ${renderedBlocks}

    <div class="footer">
      Powered by <a href="/">CreatorBrain</a> · Agentic Creator OS
    </div>
  </div>

  <script>
    function trackClick(blockId, targetUrl) {
      if (blockId) {
        fetch('/api/bio/click/' + blockId, { method: 'POST' }).catch(function(){});
      }
    }
  </script>
</body>
</html>`;

  return c.html(html);
};

app.get('/@:handle', handleBioPage);
app.get('/%40:handle', handleBioPage);

// ==========================================
// STATIC ASSETS / SPA FALLBACK
// ==========================================
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

// ==========================================
// CLOUDFLARE WORKER EXPORT WITH CRON TRIGGER
// ==========================================
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron Trigger] Autonomous Agent Run started at:', new Date().toISOString());

    const dbClient = new DBClient(env.DB);
    const demoCreator = await dbClient.getCreator('creator_demo_tech_kabir');

    if (demoCreator) {
      ctx.waitUntil(
        Promise.all([
          runOrchestrator(demoCreator.id, env.DB),
          runMemoryCurator(demoCreator.id, env.DB),
        ])
          .then(() => {
            console.log('[Cron Trigger] Autonomous Memory Curator and Orchestrator run completed.');
          })
          .catch((err) => {
            console.error('[Cron Trigger Error]:', err);
          })
      );
    }
  },
};
