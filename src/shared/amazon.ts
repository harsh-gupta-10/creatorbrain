export const AMAZON_MARKETPLACES = ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.ca'] as const;
export type AmazonMarketplace = (typeof AMAZON_MARKETPLACES)[number];
export const AMAZON_CURRENCIES: Record<string, string> = {
  'amazon.com': 'USD',
  'amazon.in': 'INR',
  'amazon.co.uk': 'GBP',
  'amazon.de': 'EUR',
  'amazon.ca': 'CAD',
};
export const ASIN_RE = /^[A-Z0-9]{10}$/i;
export const TRACKING_ID_RE = /^[\w-]{3,40}$/;

export function amazonProductUrl(value: string, marketplace: string): URL | null {
  const input = value.trim();
  if (!AMAZON_MARKETPLACES.some((m) => m === marketplace)) return null;
  if (ASIN_RE.test(input)) return new URL(`https://www.${marketplace}/dp/${input.toUpperCase()}`);
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname !== marketplace && url.hostname !== `www.${marketplace}`) return null;
    if (!/\/(?:dp|gp\/product|gp\/aw\/d)\/[a-z0-9]{10}(?:\/|$)/i.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function tagAmazonProduct(value: string, marketplace: string, tag: string): string | null {
  const url = amazonProductUrl(value, marketplace);
  if (!url || !TRACKING_ID_RE.test(tag)) return null;
  url.searchParams.set('tag', tag);
  return url.href;
}

export function amazonProductAsin(url: URL): string | undefined {
  return url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase();
}

export interface AmazonReportFile {
  filename: string;
  reportType?: string;
  lastModified?: string;
}
