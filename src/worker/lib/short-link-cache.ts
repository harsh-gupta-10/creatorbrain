import { z } from 'zod';
import type { ShortLink } from '../../shared/types';

const CachedShortLinkSchema = z.object({
  version: z.literal(2),
  id: z.string().min(1),
  slug: z.string().min(1),
  creator_id: z.string().min(1),
  destination_url: z.string().url(),
  expires_at: z.string().datetime().nullable(),
});

export type CachedShortLink = z.infer<typeof CachedShortLinkSchema>;

export function serializeShortLinkCache(link: ShortLink): string {
  return JSON.stringify({
    version: 2,
    id: link.id,
    slug: link.slug,
    creator_id: link.creator_id,
    destination_url: link.destination_url,
    expires_at: link.expires_at || null,
  } satisfies CachedShortLink);
}

export function parseShortLinkCache(value: string | null): CachedShortLink | null {
  if (!value) return null;
  try {
    const result = CachedShortLinkSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** KV requires a TTL of at least 60 seconds; short expirations use D1 only. */
export function shortLinkCacheTtl(expiresAt?: string | null, now = Date.now()): number | null {
  if (!expiresAt) return 86_400;
  const remaining = Math.floor((Date.parse(expiresAt) - now) / 1000);
  if (!Number.isFinite(remaining) || remaining < 60) return null;
  return Math.min(86_400, remaining);
}
