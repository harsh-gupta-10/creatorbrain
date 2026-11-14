import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from './env';
import { getSession } from './routes/auth';

/** API paths reachable without a session */
const PUBLIC_API = [/^\/api\/auth\//, /^\/api\/bio\/click\//, /^\/api\/links\/report-abuse$/, /^\/api\/health$/, /^\/api\/public\//];

const isWrite = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

/**
 * Blocks cross-site writes. Browsers always send Origin on cross-origin POST/PUT/DELETE,
 * so a write whose Origin differs from this host is rejected (CSRF defence on top of SameSite=Lax).
 */
export const sameOriginWrites: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isWrite(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin && origin !== new URL(c.req.url).origin) {
      return c.json({ error: 'Cross-site request blocked' }, 403);
    }
  }
  await next();
};

/**
 * Resolves the session once per request and exposes it as c.get('creator').
 * Also enforces that the shared sample workspace is read-only.
 */
export const requireCreator: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (PUBLIC_API.some((re) => re.test(c.req.path))) return next();

  const { creator, isSample } = await getSession(c.env.DB, getCookie(c, 'cb_session'));
  if (!creator) return c.json({ error: 'Sign in to continue' }, 401);
  if (isSample && isWrite(c.req.method)) {
    return c.json({ error: 'This is the sample workspace. Create an account to make changes', sample: true }, 403);
  }
  c.set('creator', creator);
  c.set('isSample', isSample);
  await next();
};

/** Per-IP rate limit for sign-in and sign-up, using the Workers Rate Limiting binding when present */
export const authRateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'POST' && c.env.AUTH_LIMITER) {
    const ip = c.req.header('CF-Connecting-IP') || 'local';
    const { success } = await c.env.AUTH_LIMITER.limit({ key: `${ip}:${c.req.path}` });
    if (!success) return c.json({ error: 'Too many attempts. Wait a minute and try again' }, 429);
  }
  await next();
};

/** Conservative security headers for every response */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  // Responses from the assets binding have immutable headers; copy before editing
  c.res = new Response(c.res.body, c.res);
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'DENY');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (new URL(c.req.url).protocol === 'https:') {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if ((h.get('Content-Type') || '').includes('text/html')) {
    h.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }
  if (c.req.path.startsWith('/api/')) h.set('Cache-Control', 'no-store');
};
