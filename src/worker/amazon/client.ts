import type { Product } from '../../shared/types';
import { MOCK_AMAZON_PRODUCTS } from './fixtures';

/**
 * Amazon product lookup for one creator.
 *
 * Live mode uses the Product Advertising API 5.0 (SearchItems) signed with AWS SigV4,
 * with the creator's own access key, secret key and partner tag. Without keys, or when
 * Amazon rejects a request, it returns a small sample catalog that is always marked
 * `is_mock = 1` so the UI never presents sample prices as live ones.
 */

export interface AmazonCredentials {
  accessKey?: string;
  secretKey?: string;
  partnerTag: string;
  marketplace?: string;
}

const HOSTS: Record<string, { host: string; region: string; currency: string }> = {
  'amazon.com': { host: 'webservices.amazon.com', region: 'us-east-1', currency: 'USD' },
  'amazon.ca': { host: 'webservices.amazon.ca', region: 'us-east-1', currency: 'CAD' },
  'amazon.in': { host: 'webservices.amazon.in', region: 'eu-west-1', currency: 'INR' },
  'amazon.co.uk': { host: 'webservices.amazon.co.uk', region: 'eu-west-1', currency: 'GBP' },
  'amazon.de': { host: 'webservices.amazon.de', region: 'eu-west-1', currency: 'EUR' },
};

const RESOURCES = [
  'Images.Primary.Large',
  'ItemInfo.Title',
  'ItemInfo.Features',
  'Offers.Listings.Price',
  'Offers.Listings.Availability.Message',
];

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

/** AWS Signature Version 4 headers for a PA-API 5.0 operation */
export async function signPaapiRequest(opts: {
  accessKey: string;
  secretKey: string;
  host: string;
  region: string;
  target: string;
  path: string;
  body: string;
  now?: Date;
}): Promise<Record<string, string>> {
  const now = opts.now || new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const service = 'ProductAdvertisingAPI';
  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: opts.host,
    'x-amz-date': amzDate,
    'x-amz-target': opts.target,
  };
  const names = Object.keys(headers).sort();
  const canonical = [
    'POST',
    opts.path,
    '',
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    names.join(';'),
    await sha256(opts.body),
  ].join('\n');
  const scope = `${day}/${opts.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
  let key = await hmac(enc.encode(`AWS4${opts.secretKey}`), day);
  key = await hmac(key, opts.region);
  key = await hmac(key, service);
  key = await hmac(key, 'aws4_request');
  const signature = hex(await hmac(key, toSign));
  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  };
}

export class AmazonCreatorsClient {
  private credentials?: AmazonCredentials;
  private live: boolean;
  private marketplace: string;
  lastError: string | null = null;

  constructor(credentials?: AmazonCredentials) {
    this.credentials = credentials;
    this.marketplace =
      credentials?.marketplace && HOSTS[credentials.marketplace] ? credentials.marketplace : 'amazon.com';
    this.live = !!(credentials?.accessKey && credentials?.secretKey && credentials?.partnerTag);
  }

  isMock(): boolean {
    return !this.live;
  }

  getMarketplace(): string {
    return this.marketplace;
  }

  getPartnerTag(): string {
    return this.credentials?.partnerTag || '';
  }

  private timestamp(): string {
    return new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }

  private sample(creatorId: string, query?: string): Product[] {
    const q = (query || '').toLowerCase();
    const matched = q
      ? MOCK_AMAZON_PRODUCTS.filter((p) => p.title.toLowerCase().includes(q) || p.asin.toLowerCase() === q)
      : [];
    return (matched.length ? matched : MOCK_AMAZON_PRODUCTS).map((p) => ({
      ...p,
      id: `prod_${p.asin.toLowerCase()}`,
      creator_id: creatorId,
      price_timestamp: 'sample price, not live',
      is_mock: 1,
      last_checked_at: new Date().toISOString(),
    }));
  }

  async searchItems(keywords: string, creatorId: string): Promise<Product[]> {
    if (!this.live) return this.sample(creatorId, keywords);

    const { host, region, currency } = HOSTS[this.marketplace];
    const path = '/paapi5/searchitems';
    const body = JSON.stringify({
      Keywords: keywords.slice(0, 200),
      PartnerTag: this.credentials!.partnerTag,
      PartnerType: 'Associates',
      Marketplace: `www.${this.marketplace}`,
      ItemCount: 10,
      Resources: RESOURCES,
    });

    try {
      const headers = await signPaapiRequest({
        accessKey: this.credentials!.accessKey!,
        secretKey: this.credentials!.secretKey!,
        host,
        region,
        path,
        body,
        target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      });
      const res = await fetch(`https://${host}${path}`, { method: 'POST', headers, body });
      interface PaapiItem {
        ASIN: string;
        ItemInfo?: { Title?: { DisplayValue?: string }; Features?: { DisplayValues?: string[] } };
        DetailPageURL?: string;
        Images?: { Primary?: { Large?: { URL?: string } } };
        Offers?: {
          Listings?: Array<{
            Price?: { DisplayAmount?: string; Currency?: string };
            Availability?: { Message?: string };
          }>;
        };
      }
      interface PaapiSearchResponse {
        Errors?: Array<{ Message?: string }>;
        SearchResult?: { Items?: PaapiItem[] };
      }
      const data = (await res.json().catch(() => ({}))) as PaapiSearchResponse;
      if (!res.ok) {
        throw new Error(data?.Errors?.[0]?.Message || `Amazon returned ${res.status}`);
      }
      const now = new Date().toISOString();
      return (data.SearchResult?.Items || []).map((item: PaapiItem): Product => {
        const listing = item.Offers?.Listings?.[0];
        return {
          id: `prod_${String(item.ASIN).toLowerCase()}`,
          creator_id: creatorId,
          asin: item.ASIN,
          title: item.ItemInfo?.Title?.DisplayValue || item.ASIN,
          price_str: listing?.Price?.DisplayAmount || 'See price on Amazon',
          price_timestamp: this.timestamp(),
          currency: listing?.Price?.Currency || currency,
          image_url: item.Images?.Primary?.Large?.URL || '',
          product_url: item.DetailPageURL || `https://www.${this.marketplace}/dp/${item.ASIN}`,
          features_json: JSON.stringify(item.ItemInfo?.Features?.DisplayValues || []),
          specs_json: '{}',
          pros_cons_json: JSON.stringify({ pros: [], cons: [] }),
          is_mock: 0,
          availability: listing?.Availability?.Message || 'Check availability',
          last_checked_at: now,
          created_at: now,
        };
      });
    } catch (err: unknown) {
      this.lastError = err instanceof Error ? err.message : 'Amazon request failed';
      console.warn('[Amazon] live search failed, showing sample catalog:', this.lastError);
      return this.sample(creatorId, keywords);
    }
  }

  async getItems(asins: string[], creatorId: string): Promise<Product[]> {
    if (!this.live) return this.sample(creatorId).filter((p) => asins.includes(p.asin));
    return this.searchItems(asins[0] || '', creatorId);
  }

  /** Adds the creator's tracking ID. Without one the URL is returned untouched */
  buildAffiliateUrl(originalUrl: string, customPartnerTag?: string): string {
    const tag = customPartnerTag || this.getPartnerTag();
    if (!tag) return originalUrl;
    try {
      const u = new URL(originalUrl);
      u.searchParams.set('tag', tag);
      return u.toString();
    } catch {
      return originalUrl;
    }
  }

  getMandatoryDisclosure(): string {
    return 'As an Amazon Associate I earn from qualifying purchases.';
  }
}
