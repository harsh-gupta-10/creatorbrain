import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { fetchYouTubeChannel, fetchChannelWithDataApi, ChannelNotFoundError } from '../content/youtube';
import { auditChannel } from '../content/audit';

/** Endpoints anyone can use without an account */
export const publicRoutes = new Hono<AppEnv>();

const AuditSchema = z.object({
  channel: z.string().trim().min(2, 'Paste your channel link, like https://www.youtube.com/@yourhandle').max(200),
});
const CACHE_SECONDS = 6 * 3600;

// Free channel audit from public data. Rate limited per IP and cached per channel.
publicRoutes.post('/audit', async (c) => {
  const parsed = AuditSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the link' }, 400);

  if (c.env.AUTH_LIMITER) {
    const ip = c.req.header('CF-Connecting-IP') || 'local';
    const { success } = await c.env.AUTH_LIMITER.limit({ key: `${ip}:audit` });
    if (!success) return c.json({ error: 'Too many audits in a minute. Wait a moment and try again' }, 429);
  }

  const input = parsed.data.channel;
  const cacheKey = `audit:${input.toLowerCase().replace(/^https?:\/\/(www\.)?/, '')}`;
  const cached = await c.env.KV?.get(cacheKey, 'json').catch(() => null);
  if (cached) return c.json({ audit: cached, cached: true });

  try {
    // The Data API includes subscriber counts (for the reach score); the public feed is the keyless fallback
    const channel = c.env.YOUTUBE_API_KEY
      ? await fetchChannelWithDataApi(input, c.env.YOUTUBE_API_KEY, 20).catch((err) => {
          if (err instanceof ChannelNotFoundError) throw err;
          return fetchYouTubeChannel(input);
        })
      : await fetchYouTubeChannel(input);
    const audit = auditChannel(channel);
    await c.env.KV?.put(cacheKey, JSON.stringify(audit), { expirationTtl: CACHE_SECONDS }).catch(() => {});
    return c.json({ audit, cached: false });
  } catch (err: any) {
    if (err instanceof ChannelNotFoundError) {
      return c.json({ error: `${err.message}. Use a link like https://www.youtube.com/@yourhandle`, code: 'channel_not_found' }, 404);
    }
    return c.json({ error: err?.message || 'The audit failed. Try again in a minute' }, 502);
  }
});
