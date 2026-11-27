import type { z } from 'zod';
import { AMAZON_MARKETPLACES } from '../../shared/amazon';
import { CreateShortLinkSchema, type ShortLink } from '../../shared/types';
import { DBClient } from '../db/queries';
import type { Env } from '../env';
import { isSafePublicHttpUrl } from './url-safety';

export function isAmazonDestination(hostname: string): boolean {
  return ['amzn.to', 'a.co', ...AMAZON_MARKETPLACES].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

export class ShortLinkError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409
  ) {
    super(message);
  }
}

export async function saveShortLink(
  env: Env,
  creatorId: string,
  origin: string,
  input: z.input<typeof CreateShortLinkSchema>,
  reuse = false
): Promise<{ shortLink: ShortLink; shortUrl: string }> {
  const parsed = CreateShortLinkSchema.safeParse(input);
  if (!parsed.success) throw new ShortLinkError(parsed.error.issues[0]?.message || 'Invalid link data', 400);
  const { destination_url, title, utm_source, utm_medium, utm_campaign, expires_at, slug } = parsed.data;
  if (!isSafePublicHttpUrl(destination_url)) {
    throw new ShortLinkError('Enter a public HTTP or HTTPS destination.', 400);
  }
  const url = new URL(destination_url);
  if (url.origin === origin && url.pathname.startsWith('/s/')) {
    throw new ShortLinkError(
      'That URL is already a CreatorBrain short link. Paste its original destination to create another.',
      400
    );
  }
  if (expires_at && Date.parse(expires_at) <= Date.now()) {
    throw new ShortLinkError('Expiration must be a future date and time', 400);
  }
  if (utm_source) url.searchParams.set('utm_source', utm_source);
  if (utm_medium) url.searchParams.set('utm_medium', utm_medium);
  if (utm_campaign) url.searchParams.set('utm_campaign', utm_campaign);

  const db = new DBClient(env.DB);
  const amazon = isAmazonDestination(url.hostname);
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = crypto.randomUUID();
    const link: ShortLink = {
      id: `link_${id}`,
      creator_id: creatorId,
      slug: slug || `${amazon ? 'amazon-' : ''}${id.replaceAll('-', '').slice(0, 10)}`,
      destination_url: url.href,
      destination_domain: url.hostname,
      title: title || (amazon ? 'Amazon product link' : `${url.hostname} Link`),
      utm_source,
      utm_medium,
      utm_campaign,
      expires_at: expires_at || undefined,
      total_clicks: 0,
      created_at: new Date().toISOString(),
    };
    const saved = await db.createShortLink(link, reuse && !slug && !expires_at);
    if (saved) return { shortLink: saved, shortUrl: `${origin}/s/${saved.slug}` };
    if (slug) throw new ShortLinkError(`Custom slug "${slug}" is already in use. Please pick another.`, 409);
  }
  throw new ShortLinkError('Could not allocate a short link. Please try again.', 409);
}
