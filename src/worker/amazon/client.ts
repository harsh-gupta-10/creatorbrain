import { z } from 'zod';
import { amazonProductUrl, tagAmazonProduct, ASIN_RE, type AmazonReportFile } from '../../shared/amazon';
import type { Product } from '../../shared/types';
import { MOCK_AMAZON_PRODUCTS } from './fixtures';

/**
 * Amazon product lookup for one creator.
 *
 * Live mode prefers the Creators API (OAuth 2.0) using each creator's credential ID,
 * secret, version, and partner tag. Existing PA-API 5 credentials remain supported.
 * Without valid credentials, or when Amazon rejects a request, it returns a small
 * sample catalog marked `is_mock = 1` so the UI never presents sample prices as live.
 */

export interface AmazonCredentials {
  accessKey?: string;
  secretKey?: string;
  credentialId?: string;
  credentialSecret?: string;
  credentialVersion?: '3.1' | '3.2' | '3.3';
  partnerTag: string;
  marketplace?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const TOKEN_ENDPOINTS = {
  '3.1': 'https://api.amazon.com/auth/o2/token',
  '3.2': 'https://api.amazon.co.uk/auth/o2/token',
  '3.3': 'https://api.amazon.co.jp/auth/o2/token',
} as const;
const tokenCache = new Map<string, CachedToken>();

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

export class AmazonApiError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function amazonError(
  status: number,
  data: { reason?: string; type?: string; errors?: { code?: string }[] },
  authentication = false
) {
  const code = data.reason || data.errors?.[0]?.code || data.type;
  if (code === 'AssociateNotEligible')
    return new AmazonApiError(
      code,
      'Amazon accepted your credentials, but this Associates account is not eligible for live catalog access.'
    );
  if (code === 'InvalidPartnerTag' || code === 'PartnerTagNotMapped')
    return new AmazonApiError(
      code,
      'Amazon rejected the tracking ID for this store. Check the tracking ID and marketplace in Settings.'
    );
  if (status === 429)
    return new AmazonApiError('RateLimited', 'Amazon is limiting requests. Wait a minute and try again.');
  if (status === 401 || (authentication && status === 400))
    return new AmazonApiError(
      'AuthenticationFailed',
      'Amazon could not authenticate the connection. Check the credential pair and its version.'
    );
  if (status === 403)
    return new AmazonApiError('AccessDenied', 'Amazon denied access to this operation for the selected store.');
  if (status === 404) return new AmazonApiError('NotFound', 'Amazon could not find that item or report in this store.');
  return new AmazonApiError('AmazonUnavailable', 'Amazon could not complete this request. Try again later.');
}

const reportSchema = z.object({
  filename: z.string().min(1).max(512),
  reportType: z.string().max(100).optional(),
  lastModified: z.string().max(80).optional(),
});

export class AmazonCreatorsClient {
  private credentials?: AmazonCredentials;
  private live: boolean;
  private marketplace: string;
  lastError: string | null = null;
  lastErrorCode: string | null = null;

  hasCreatorsCredentials(): boolean {
    return !!(
      this.credentials?.credentialId &&
      this.credentials.credentialSecret &&
      this.credentials.credentialVersion
    );
  }

  constructor(credentials?: AmazonCredentials) {
    this.credentials = credentials;
    this.marketplace =
      credentials?.marketplace && HOSTS[credentials.marketplace] ? credentials.marketplace : 'amazon.com';
    const hasCreatorsCredentials = !!(
      credentials?.credentialId &&
      credentials.credentialSecret &&
      credentials.credentialVersion
    );
    const hasLegacyCredentials = !!(credentials?.accessKey && credentials?.secretKey);
    this.live = !!credentials?.partnerTag && (hasCreatorsCredentials || hasLegacyCredentials);
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

  private async getCreatorsAccessToken(): Promise<string> {
    const { credentialId, credentialSecret, credentialVersion } = this.credentials || {};
    if (!credentialId || !credentialSecret || !credentialVersion)
      throw new AmazonApiError('NotConfigured', 'Save Creators API credentials in Settings first.');
    const key = await sha256(JSON.stringify([credentialId, credentialSecret, credentialVersion]));
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const response = await fetch(TOKEN_ENDPOINTS[credentialVersion], {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: credentialId,
        client_secret: credentialSecret,
        scope: 'creatorsapi::default',
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !data.access_token) {
      throw amazonError(response.status, {}, true);
    }
    const lifetimeMs = Math.max(60, Math.min(data.expires_in || 3600, 3600)) * 1000;
    tokenCache.set(key, { token: data.access_token, expiresAt: Date.now() + lifetimeMs });
    return data.access_token;
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
    this.lastError = null;
    this.lastErrorCode = null;
    if (!this.live) return this.sample(creatorId, keywords);
    if (this.credentials?.credentialId && this.credentials.credentialSecret && this.credentials.credentialVersion) {
      return this.creatorsItems('searchItems', { keywords: keywords.slice(0, 200), itemCount: 10 }, creatorId);
    }

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
      const res = await fetch(`https://${host}${path}`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
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
      this.lastError =
        err instanceof Error && err.name === 'TimeoutError'
          ? 'Amazon timed out.'
          : 'The legacy Product Advertising API could not complete this request. Connect Creators API credentials in Settings.';
      this.lastErrorCode = 'LegacyApiFailed';
      return [];
    }
  }

  private async requestCreators<T>(
    scope: 'catalog' | 'reports',
    operation: 'searchItems' | 'getItems' | 'getVariations' | 'getBrowseNodes' | 'listReports' | 'getReport',
    payload?: object
  ): Promise<T> {
    try {
      const token = await this.getCreatorsAccessToken();
      const marketplace = `www.${this.marketplace}`;
      const body = scope === 'catalog' ? { ...payload, marketplace, partnerTag: this.getPartnerTag() } : payload;
      const response = await fetch(`https://creatorsapi.amazon/${scope}/v1/${operation}`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: {
          authorization: `Bearer ${token}`,
          'x-marketplace': marketplace,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw amazonError(response.status, data || {});
      if (!data) throw amazonError(502, {});
      return data as T;
    } catch (err) {
      if (err instanceof AmazonApiError) throw err;
      throw amazonError(502, {});
    }
  }

  async listReports(): Promise<AmazonReportFile[]> {
    const data = await this.requestCreators<unknown>('reports', 'listReports');
    const parsed = z.object({ reports: z.array(reportSchema).optional() }).safeParse(data);
    if (!parsed.success) throw amazonError(502, {});
    return parsed.data.reports || [];
  }

  async getReportDownload(filename: string): Promise<string> {
    const data = await this.requestCreators<{ url?: string }>('reports', 'getReport', { filename });
    const url = URL.parse(data.url || '');
    if (
      !url ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !/(^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)
    )
      throw amazonError(502, {});
    return url.href;
  }

  async getVariations(asin: string, creatorId: string, page: number): Promise<Product[]> {
    if (!this.getPartnerTag()) {
      this.lastError = 'Save your Associates tracking ID in Settings first.';
      this.lastErrorCode = 'NotConfigured';
      return [];
    }
    return this.creatorsItems('getVariations', { asin, variationPage: page }, creatorId);
  }

  async getBrowseNodes(ids: string[]) {
    const schema = z.object({
      browseNodesResult: z
        .object({
          browseNodes: z.array(
            z.object({
              id: z.string(),
              displayName: z.string(),
              children: z.array(z.object({ id: z.string(), displayName: z.string() })).optional(),
            })
          ),
        })
        .optional(),
    });
    const parsed = schema.safeParse(
      await this.requestCreators<unknown>('catalog', 'getBrowseNodes', {
        browseNodeIds: ids,
        resources: ['browseNodes.children'],
      })
    );
    if (!parsed.success) throw amazonError(502, {});
    return parsed.data.browseNodesResult?.browseNodes || [];
  }

  private async creatorsItems(
    operation: 'getItems' | 'searchItems' | 'getVariations',
    query: object,
    creatorId: string
  ): Promise<Product[]> {
    this.lastError = null;
    this.lastErrorCode = null;
    const { currency } = HOSTS[this.marketplace];
    try {
      interface CreatorsItem {
        asin?: string;
        itemInfo?: {
          title?: { displayValue?: string };
          features?: { displayValues?: string[] };
        };
        detailPageURL?: string;
        images?: { primary?: { large?: { url?: string } } };
        offersV2?: {
          listings?: Array<{
            price?: { money?: { displayAmount?: string; currency?: string } };
            availability?: { message?: string; type?: string };
          }>;
        };
      }
      interface CreatorsSearchResponse {
        errors?: Array<{ message?: string }>;
        searchResult?: { items?: CreatorsItem[] };
        itemsResult?: { items?: CreatorsItem[] };
        variationsResult?: { items?: CreatorsItem[] };
      }
      const data = await this.requestCreators<CreatorsSearchResponse>('catalog', operation, {
        ...query,
        resources: [
          'images.primary.large',
          'itemInfo.title',
          'itemInfo.features',
          'offersV2.listings.price',
          'offersV2.listings.availability',
        ],
      });
      const now = new Date().toISOString();
      return (data.itemsResult?.items || data.searchResult?.items || data.variationsResult?.items || [])
        .filter((item): item is CreatorsItem & { asin: string } => !!item.asin && ASIN_RE.test(item.asin))
        .map((item): Product => {
          const listing = item.offersV2?.listings?.[0];
          const availability =
            listing?.availability?.message ||
            listing?.availability?.type?.toLowerCase().replaceAll('_', ' ') ||
            'Check availability';
          return {
            id: `prod_${item.asin.toLowerCase()}`,
            creator_id: creatorId,
            asin: item.asin,
            title: item.itemInfo?.title?.displayValue || item.asin,
            price_str: listing?.price?.money?.displayAmount || 'See price on Amazon',
            price_timestamp: this.timestamp(),
            currency: listing?.price?.money?.currency || currency,
            image_url: item.images?.primary?.large?.url || '',
            product_url:
              amazonProductUrl(item.detailPageURL || '', this.marketplace)?.href ||
              `https://www.${this.marketplace}/dp/${item.asin}`,
            features_json: JSON.stringify(item.itemInfo?.features?.displayValues || []),
            specs_json: '{}',
            pros_cons_json: JSON.stringify({ pros: [], cons: [] }),
            is_mock: 0,
            availability,
            last_checked_at: now,
            created_at: now,
          };
        });
    } catch (err: unknown) {
      const failure = err instanceof AmazonApiError ? err : amazonError(502, {});
      this.lastError = failure.message;
      this.lastErrorCode = failure.code;
      return [];
    }
  }

  async getItems(asins: string[], creatorId: string): Promise<Product[]> {
    if (!this.live) return this.sample(creatorId).filter((p) => asins.includes(p.asin));
    if (!asins.length) return [];
    if (this.credentials?.credentialId && this.credentials.credentialSecret && this.credentials.credentialVersion) {
      return this.creatorsItems('getItems', { itemIds: asins.slice(0, 10), itemIdType: 'ASIN' }, creatorId);
    }
    const results = await this.searchItems(asins[0], creatorId);
    return results.filter((product) => asins.includes(product.asin));
  }

  /** Adds the creator's tracking ID. Without one the URL is returned untouched */
  buildAffiliateUrl(originalUrl: string, customPartnerTag?: string): string {
    const tag = customPartnerTag || this.getPartnerTag();
    if (!tag) return originalUrl;
    return tagAmazonProduct(originalUrl, this.marketplace, tag) || originalUrl;
  }

  getMandatoryDisclosure(): string {
    return 'As an Amazon Associate I earn from qualifying purchases.';
  }
}
