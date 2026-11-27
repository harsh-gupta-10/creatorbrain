import { Hono, type Context } from 'hono';
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
import { copilotRoutes } from './routes/copilot';
import { contentRoutes } from './routes/content';
import { publicRoutes } from './routes/public';
import { dealsRoutes } from './routes/deals';
import { chatRoutes } from './routes/chats';
import { analyzeContentItem, pendingItems } from './content/analyze';
import { AIRouter } from './ai/router';
import { DBClient } from './db/queries';
import { refreshYouTubeContent } from './agents/definitions/onboardingPipeline';
import { runOrchestrator, runMemoryCurator } from './agents/definitions/tutorAndCurriculum';
import type { AppEnv, Env } from './env';
import { authRateLimit, requireCreator, sameOriginWrites, securityHeaders } from './middleware';
import { isSafePublicHttpUrl, safePublicHref } from './lib/url-safety';
import { automaticLinkIcon } from '../shared/bio';
import {
  parseShortLinkCache,
  serializeShortLinkCache,
  shortLinkCacheTtl,
  type CachedShortLink,
} from './lib/short-link-cache';
import type { ShortLink } from '../shared/types';
import { isAmazonDestination } from './lib/short-links';

export type { Env };

const app = new Hono<AppEnv>();

// The SPA and the API share one origin, so no CORS headers are sent.
app.use('*', securityHeaders);
app.use('/api/*', sameOriginWrites);
app.use('/api/auth/*', authRateLimit);
app.use('/api/*', requireCreator);

app.get('/api/health', (c) => c.json({ ok: true }));

// Public, immutable creator icons are served through the Worker so the R2 bucket stays private.
app.get('/bio-icons/:key', async (c) => {
  const key = c.req.param('key');
  if (!/^[0-9a-f-]{36}\.(?:png|jpg|webp)$/i.test(key) || !c.env.BIO_ICONS) return c.notFound();
  const object = await c.env.BIO_ICONS.get(key);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
});

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
app.route('/api/copilot', copilotRoutes);
app.route('/api/content', contentRoutes);
app.route('/api/public', publicRoutes);
app.route('/api/deals', dealsRoutes);
app.route('/api/chats', chatRoutes);

// ==========================================
// SHORT LINK TRANSPARENT REDIRECT (/s/:slug)
// ==========================================
app.on(['GET', 'POST'], '/s/:slug', async (c) => {
  const slug = c.req.param('slug');
  const dbClient = new DBClient(c.env.DB);
  let link: ShortLink | CachedShortLink | null = null;

  if (c.env.KV) {
    try {
      const cached = parseShortLinkCache(await c.env.KV.get(`link:${slug}`));
      if (cached?.slug === slug) link = cached;
    } catch {
      // KV is an optimization; fall back to the D1 source of truth.
    }
  }

  if (!link) {
    const dbLink = await dbClient.getShortLinkBySlug(slug);
    link = dbLink;
    if (dbLink && c.env.KV) {
      const cacheTtl = shortLinkCacheTtl(dbLink.expires_at);
      if (cacheTtl) {
        try {
          await c.env.KV.put(`link:${slug}`, serializeShortLinkCache(dbLink), { expirationTtl: cacheTtl });
        } catch {
          // A failed cache write must not prevent a valid redirect.
        }
      }
    }
  }

  if (!link) {
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Link not found · CreatorBrain</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Geist',ui-sans-serif,system-ui,-apple-system,sans-serif;background:#111214;color:#ededed;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;-webkit-font-smoothing:antialiased}h1{font-size:20px;line-height:28px;font-weight:500}p{margin-top:8px;font-size:14px;line-height:20px;color:#a1a1a6}code{font-family:'Geist Mono',ui-monospace,monospace}a{display:inline-flex;align-items:center;height:36px;margin-top:24px;padding:0 16px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#ededed;font-size:14px;text-decoration:none;transition:background-color 150ms ease}a:hover{background:rgba(255,255,255,0.05)}</style></head>
<body>
  <main>
    <h1>This link does not go anywhere</h1>
    <p>The short link does not exist or has expired</p>
    <a href="/">Go to CreatorBrain</a>
  </main>
</body>
</html>`,
      404
    );
  }

  if (!isSafePublicHttpUrl(link.destination_url)) {
    await c.env.KV?.delete(`link:${slug}`);
    return c.text('This short link has an invalid destination.', 410);
  }

  if (link.expires_at && Date.parse(link.expires_at) <= Date.now()) {
    await c.env.KV?.delete(`link:${slug}`);
    return c.text('This short link has expired.', 410);
  }

  const target = link.destination_url;
  const hostname = new URL(target).hostname;
  const amazon = isAmazonDestination(hostname);
  if (amazon && c.req.method === 'GET') {
    // Click previews and bots can open the short URL without sending a visitor to Amazon.
    // The hostname comes from a fixed Amazon host list and URL.hostname cannot contain markup.
    c.header('Cache-Control', 'no-store');
    return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Continue to Amazon · CreatorBrain</title>
      <style>body{margin:0;background:#fafafa;color:#171717;font:16px system-ui;min-height:100dvh;display:grid;place-items:center}
      main{margin:24px;padding:32px;max-width:430px;background:white;border:1px solid #ddd;border-radius:16px}
      p{line-height:1.5}button{padding:12px 16px;background:#171717;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer}</style></head>
      <body><main><p>CreatorBrain</p><h1>Continue to Amazon</h1>
      <p>Destination: <strong>${hostname}</strong></p>
      <p>This link may earn the creator a commission.</p>
      <form method="post"><button type="submit">Open Amazon</button></form></main></body></html>`);
  }
  if (c.req.method === 'POST' && (!amazon || c.req.header('origin') !== new URL(c.req.url).origin)) {
    return c.text('Open the short link first, then choose Open Amazon.', 403);
  }
  if (c.req.method === 'HEAD') {
    return c.body(null, 200);
  }

  // Record click analytics via waitUntil (zero latency penalty)
  {
    const cf = (c.req.raw as Request & { cf?: { country?: string } }).cf || {};
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

  return c.redirect(target, amazon ? 303 : 302);
});

// ==========================================
// PUBLIC LINK-IN-BIO PAGE (/@:handle)
// ==========================================
const handleBioPage = async (c: Context<AppEnv>) => {
  // The route param is already percent-decoded by Hono, so it starts with a literal '@'
  const handle = String(c.req.param('handle') || '')
    .replace(/^@/, '')
    .toLowerCase();
  if (!handle) return c.text('Not found', 404);
  const dbClient = new DBClient(c.env.DB);
  const { creator, bioPage, blocks } = await dbClient.getBioPageWithBlocks(handle);

  if (!creator || !bioPage) {
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Page not found · CreatorBrain</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Geist',ui-sans-serif,system-ui,-apple-system,sans-serif;background:#111214;color:#ededed;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;-webkit-font-smoothing:antialiased}h1{font-size:20px;line-height:28px;font-weight:500}p{margin-top:8px;font-size:14px;line-height:20px;color:#a1a1a6}code{font-family:'Geist Mono',ui-monospace,monospace}a{display:inline-flex;align-items:center;height:36px;margin-top:24px;padding:0 16px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#ededed;font-size:14px;text-decoration:none;transition:background-color 150ms ease}a:hover{background:rgba(255,255,255,0.05)}</style></head>
<body>
  <main>
    <h1>This page is not here</h1>
    <p>The handle may have changed, or the page is not published yet</p>
    <a href="/">Go to CreatorBrain</a>
  </main>
</body>
</html>`,
      404
    );
  }

  // Page palette: quiet dark graphite. The creator's accent is used only for the
  // primary link border, link hover and the buy button.
  const themeAccent = /^#[0-9a-f]{6}$/i.test(bioPage.accent_color || '') ? bioPage.accent_color : '#ededed';
  const accentInk = (() => {
    const n = parseInt(themeAccent.slice(1), 16);
    const lin = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.18 ? '#111214' : '#ffffff';
  })();
  const displayName = bioPage.custom_title || creator.name;
  const activeBlocks = blocks.filter((b) => b.is_active);
  const firstLinkId = activeBlocks.find((b) => b.type === 'link')?.id;
  const hasProducts = activeBlocks.some((b) => b.type === 'product_card' && b.product);
  const arrowSvg =
    '<svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

  const origin = new URL(c.req.url).origin;

  // Everything below comes from creators, so escape text and normalize creator-provided URLs.
  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const safeUrl = (v: unknown) => esc(safePublicHref(String(v ?? ''), origin));

  const renderedBlocks = activeBlocks
    .map((b) => {
      if (b.type === 'product_card' && b.product) {
        const prod = b.product;
        const href = safeUrl(b.url || prod.product_url);
        return `
      <div class="product">
        <img src="${safeUrl(prod.image_url)}" alt="${esc(prod.title || 'Product')}" width="64" height="64" class="product-img" loading="lazy" />
        <div class="product-info">
          <div class="product-title">${esc(prod.title)}</div>
          <div class="product-price">${esc(prod.price_str)}</div>
          <div class="product-asof">Price as of ${esc(prod.price_timestamp)}</div>
        </div>
        <a href="${href}" target="_blank" rel="noopener noreferrer sponsored" class="btn-buy" data-block="${esc(b.id)}" aria-label="Buy ${esc(prod.title)} on Amazon">Buy</a>
      </div>`;
      }

      if (b.type === 'link') {
        const customIcon = b.icon_url ? safePublicHref(b.icon_url, origin) : '';
        const autoIcon = automaticLinkIcon(b.url);
        const iconUrl = customIcon && customIcon !== '#' ? customIcon : autoIcon ? safePublicHref(autoIcon, origin) : '';
        return `
      <a href="${safeUrl(b.url)}" target="_blank" rel="noopener noreferrer" class="link${b.id === firstLinkId ? ' link-primary' : ''}" data-block="${esc(b.id)}" aria-label="${esc(b.title || 'Link')}">
        <span class="link-main">${iconUrl ? `<img class="link-icon" src="${esc(iconUrl)}" alt="" width="24" height="24" loading="lazy" />` : ''}<span class="link-title">${esc(b.title || 'Link')}</span></span>
        ${arrowSvg}
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
              `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="social" aria-label="Visit ${safeName} on ${esc(platform)}">${esc(platform)}</a>`
          )
          .join('');
        return `<div class="socials">${socialItems}</div>`;
      }

      if (b.type === 'text') {
        let textContent = b.title || '';
        try {
          const parsed = b.content_json ? JSON.parse(b.content_json) : null;
          if (parsed?.text) textContent = parsed.text;
        } catch {
          // ignore
        }
        return `<p class="text">${esc(textContent)}</p>`;
      }

      if (b.type === 'divider') {
        return `<hr class="divider" />`;
      }

      return '';
    })
    .join('\n');

  const avatarHtml = creator.avatar_url
    ? `<img src="${safeUrl(creator.avatar_url)}" alt="${esc(displayName)} profile photo" width="80" height="80" class="avatar" />`
    : `<div class="avatar avatar-initial" aria-hidden="true">${esc((displayName || '').slice(0, 1))}</div>`;
  const bioText = esc(bioPage.custom_bio || creator.bio || '');
  const safeName = esc(displayName);
  const safeHandle = esc(creator.handle);
  const pageUrl = `${origin}/@${encodeURIComponent(creator.handle)}`;
  // og:image must be absolute; use the same URL validation as creator links.
  const ogImage = (() => {
    const href = safePublicHref(String(creator.avatar_url ?? ''), origin);
    return href === '#' ? '' : esc(new URL(href, origin).href);
  })();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#111214">
  <title>${safeName} (@${safeHandle})</title>
  <meta name="description" content="${bioText}">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${safeName} (@${safeHandle})">
  <meta property="og:description" content="${bioText}">
  <meta property="og:url" content="${esc(pageUrl)}">
  ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #111214;
      --fg: #ededed;
      --fg-2: #a1a1a6;
      --line: rgba(255, 255, 255, 0.08);
      --raised: rgba(255, 255, 255, 0.04);
      --accent: ${themeAccent};
      --accent-ink: ${accentInk};
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 22px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 64px 16px 40px;
    }
    a { color: inherit; }
    a:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
    .page { width: 100%; max-width: 480px; display: flex; flex-direction: column; }
    .profile { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .avatar { width: 80px; height: 80px; border-radius: 999px; object-fit: cover; }
    .avatar-initial {
      display: flex; align-items: center; justify-content: center;
      background: var(--raised); border: 1px solid var(--line);
      font-size: 28px; font-weight: 500;
    }
    .name { margin-top: 16px; font-size: 20px; line-height: 28px; font-weight: 500; }
    .handle { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; line-height: 20px; color: var(--fg-2); }
    .bio { margin-top: 12px; max-width: 384px; font-size: 14px; line-height: 22px; color: var(--fg-2); }
    .blocks { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
    .link {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      height: 56px; padding: 0 20px;
      background: var(--raised); border: 1px solid var(--line); border-radius: 12px;
      text-decoration: none; font-size: 15px;
      transition: border-color 150ms var(--ease), background-color 150ms var(--ease);
    }
    .link:hover { border-color: var(--accent); }
    .link-primary { border-color: var(--accent); }
    .link-main { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .link-icon { width: 24px; height: 24px; border-radius: 6px; object-fit: contain; flex-shrink: 0; background: rgba(255,255,255,0.08); }
    .link-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .arrow { flex-shrink: 0; color: var(--fg-2); }
    .product {
      display: flex; align-items: center; gap: 16px; padding: 12px;
      background: var(--raised); border: 1px solid var(--line); border-radius: 12px;
    }
    .product-img { width: 64px; height: 64px; border-radius: 8px; object-fit: contain; background: #fff; padding: 4px; flex-shrink: 0; }
    .product-info { flex: 1; min-width: 0; }
    .product-title { font-size: 14px; line-height: 20px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .product-price { margin-top: 4px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums; }
    .product-asof { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; line-height: 16px; color: var(--fg-2); }
    .btn-buy {
      display: inline-flex; align-items: center; height: 36px; padding: 0 16px; flex-shrink: 0;
      background: var(--accent); color: var(--accent-ink);
      border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none;
      transition: opacity 150ms var(--ease);
    }
    .btn-buy:hover { opacity: 0.9; }
    .socials { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 4px 0; }
    .social {
      display: inline-flex; align-items: center; height: 32px; padding: 0 12px;
      border: 1px solid var(--line); border-radius: 8px;
      font-size: 13px; color: var(--fg-2); text-decoration: none; text-transform: capitalize;
      transition: background-color 150ms var(--ease), color 150ms var(--ease);
    }
    .social:hover { background: rgba(255, 255, 255, 0.05); color: var(--fg); }
    .text { padding: 4px 8px; font-size: 14px; line-height: 22px; color: var(--fg-2); text-align: center; }
    .divider { border: 0; height: 1px; background: var(--line); margin: 8px 0; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); text-align: center; }
    .disclosure { max-width: 320px; margin: 0 auto 16px; font-size: 12px; line-height: 18px; color: var(--fg-2); }
    .made-with { font-size: 12px; color: var(--fg-2); text-decoration: none; transition: color 150ms var(--ease); }
    .made-with:hover { color: var(--fg); }
  </style>
</head>
<body>
  <div class="page">
    <header class="profile">
      ${avatarHtml}
      <h1 class="name">${safeName}</h1>
      <div class="handle">@${safeHandle}</div>
      ${bioText ? `<p class="bio">${bioText}</p>` : ''}
    </header>

    <main class="blocks">
      ${renderedBlocks}
    </main>

    <footer class="footer">
      ${hasProducts ? '<p class="disclosure">As an Amazon Associate I earn from qualifying purchases. Prices and availability are accurate as of the date shown and may change.</p>' : ''}
      <a href="/" class="made-with" aria-label="Made with CreatorBrain">Made with CreatorBrain</a>
    </footer>
  </div>

  <script src="/bio-analytics.js" defer></script>
</body>
</html>`;

  return c.html(html);
};

// Hono only treats ':name' as a param at the start of a path segment, so '/@:handle'
// would be a literal path. Match the whole segment with a regex instead; it covers both
// '/@handle' and '/%40handle' (run_worker_first sends both of these to the worker).
app.get('/:handle{(?:@|%40)[^/]+}', handleBioPage);

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
  /**
   * Daily: refresh each creator's uploads, deep-study a few waiting videos, then let the
   * orchestrator and memory curator update their Brain. Bounded so one invocation stays
   * under the free tier's 50 external subrequests.
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cutoff = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
    const { results } = await env.DB.prepare(
      `SELECT id, youtube_input FROM creators
       WHERE onboarding_status = 'ready' AND youtube_input IS NOT NULL AND (last_studied_at IS NULL OR last_studied_at < ?)
       ORDER BY last_studied_at LIMIT 5`
    )
      .bind(cutoff)
      .all<{ id: string; youtube_input: string }>();

    const router = new AIRouter(env);
    const work = async () => {
      for (const row of results || []) {
        try {
          const count = await refreshYouTubeContent(env.DB, row.id, row.youtube_input, env);
          for (const id of await pendingItems(env.DB, row.id, 2)) {
            await analyzeContentItem(env.DB, env, router, id);
          }
          await env.DB.prepare('UPDATE creators SET last_studied_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), row.id)
            .run();
          await Promise.all([runOrchestrator(row.id, env.DB), runMemoryCurator(row.id, env.DB)]);
          console.log(`[Cron] Refreshed ${count} uploads for ${row.id}`);
        } catch (err) {
          console.error(`[Cron] Refresh failed for ${row.id}`, err);
        }
      }
    };
    ctx.waitUntil(work());
  },
};
