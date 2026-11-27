import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  resolveMasterSecret,
  MissingEncryptionKeyError,
} from '../src/worker/amazon/crypto';
import { signPaapiRequest, AmazonCreatorsClient } from '../src/worker/amazon/client';
import { isSafePublicHttpUrl, safePublicHref } from '../src/worker/lib/url-safety';
import { parseShortLinkCache, serializeShortLinkCache, shortLinkCacheTtl } from '../src/worker/lib/short-link-cache';

const SECRET = 'a'.repeat(48);

describe('Per-creator credential encryption', () => {
  it('round-trips a secret', async () => {
    const sealed = await encryptSecret('AKIAEXAMPLEKEY12345', SECRET, 'creator_1:access_key');
    expect(isEncrypted(sealed)).toBe(true);
    expect(sealed).not.toContain('AKIAEXAMPLEKEY12345');
    expect(await decryptSecret(sealed, SECRET, 'creator_1:access_key')).toBe('AKIAEXAMPLEKEY12345');
  });

  it('uses a fresh IV every time', async () => {
    const a = await encryptSecret('same-value', SECRET, 'c:f');
    const b = await encryptSecret('same-value', SECRET, 'c:f');
    expect(a).not.toBe(b);
    expect(a.split(':')[1]).not.toBe(b.split(':')[1]);
  });

  it("refuses to decrypt another creator's ciphertext", async () => {
    const sealed = await encryptSecret('mytag-20', SECRET, 'creator_1:partner_tag');
    await expect(decryptSecret(sealed, SECRET, 'creator_2:partner_tag')).rejects.toThrow();
  });

  it('refuses the wrong master key', async () => {
    const sealed = await encryptSecret('mytag-20', SECRET, 'c:f');
    await expect(decryptSecret(sealed, 'b'.repeat(48), 'c:f')).rejects.toThrow();
  });

  it('detects tampering', async () => {
    const sealed = await encryptSecret('mytag-20', SECRET, 'c:f');
    const [v, iv, ct] = sealed.split(':');
    const flipped = ct.slice(0, -2) + (ct.slice(-2) === 'AA' ? 'AB' : 'AA');
    await expect(decryptSecret(`${v}:${iv}:${flipped}`, SECRET, 'c:f')).rejects.toThrow();
  });

  it('requires ENCRYPTION_KEY outside development', () => {
    expect(() => resolveMasterSecret({ ENVIRONMENT: 'production' })).toThrow(MissingEncryptionKeyError);
    expect(() => resolveMasterSecret({ ENVIRONMENT: 'production', ENCRYPTION_KEY: 'short' })).toThrow(
      MissingEncryptionKeyError
    );
    expect(resolveMasterSecret({ ENVIRONMENT: 'production', ENCRYPTION_KEY: SECRET })).toBe(SECRET);
    expect(resolveMasterSecret({ ENVIRONMENT: 'development' })).toBeTruthy();
  });
});

describe('Amazon client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('signs PA-API requests with SigV4', async () => {
    const headers = await signPaapiRequest({
      accessKey: 'AKIDEXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      host: 'webservices.amazon.com',
      region: 'us-east-1',
      path: '/paapi5/searchitems',
      target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      body: '{"Keywords":"mic"}',
      now: new Date('2026-11-14T10:00:00Z'),
    });
    expect(headers['x-amz-date']).toBe('20261114T100000Z');
    expect(headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20261114\/us-east-1\/ProductAdvertisingAPI\/aws4_request, SignedHeaders=content-encoding;content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/
    );
    // Deterministic for the same inputs
    const again = await signPaapiRequest({
      accessKey: 'AKIDEXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      host: 'webservices.amazon.com',
      region: 'us-east-1',
      path: '/paapi5/searchitems',
      target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
      body: '{"Keywords":"mic"}',
      now: new Date('2026-11-14T10:00:00Z'),
    });
    expect(again.Authorization).toBe(headers.Authorization);
  });

  it("tags links with the creator's own tracking ID only", () => {
    const tagged = new AmazonCreatorsClient({ partnerTag: 'maya-20', marketplace: 'amazon.com' });
    expect(tagged.buildAffiliateUrl('https://www.amazon.com/dp/B000000000')).toBe(
      'https://www.amazon.com/dp/B000000000?tag=maya-20'
    );
    const untagged = new AmazonCreatorsClient();
    expect(untagged.buildAffiliateUrl('https://www.amazon.com/dp/B000000000')).toBe(
      'https://www.amazon.com/dp/B000000000'
    );
  });

  it('marks sample catalog results as not live', async () => {
    const client = new AmazonCreatorsClient({ partnerTag: 'maya-20' });
    expect(client.isMock()).toBe(true);
    const results = await client.searchItems('phone', 'creator_1');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.is_mock === 1)).toBe(true);
  });

  it('uses Creators API OAuth credentials, credential version, and response fields', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.includes('/auth/o2/token')) {
          return Response.json({ access_token: 'test-token', expires_in: 3600 });
        }
        return Response.json({
          searchResult: {
            items: [
              {
                asin: 'B000000001',
                detailPageURL: 'https://www.amazon.in/dp/B000000001?tag=maya-20',
                itemInfo: { title: { displayValue: 'Camera mic' }, features: { displayValues: ['Clear sound'] } },
                images: { primary: { large: { url: 'https://example.test/mic.jpg' } } },
                offersV2: {
                  listings: [
                    {
                      price: { money: { displayAmount: '₹1,299', currency: 'INR' } },
                      availability: { type: 'IN_STOCK' },
                    },
                  ],
                },
              },
            ],
          },
        });
      })
    );

    const client = new AmazonCreatorsClient({
      credentialId: 'test-credential-id',
      credentialSecret: 'test-credential-secret-that-is-long-enough',
      credentialVersion: '3.2',
      partnerTag: 'maya-20',
      marketplace: 'amazon.in',
    });
    const products = await client.searchItems('camera mic', 'creator_1');

    expect(calls[0].url).toBe('https://api.amazon.co.uk/auth/o2/token');
    expect(calls[1].url).toBe('https://creatorsapi.amazon/catalog/v1/searchItems');
    expect(new Headers(calls[1].init?.headers).get('authorization')).toBe('Bearer test-token');
    expect(new Headers(calls[1].init?.headers).get('x-marketplace')).toBe('www.amazon.in');
    expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({
      keywords: 'camera mic',
      partnerTag: 'maya-20',
      marketplace: 'www.amazon.in',
    });
    expect(products).toMatchObject([
      {
        asin: 'B000000001',
        title: 'Camera mic',
        price_str: '₹1,299',
        currency: 'INR',
        availability: 'in stock',
        is_mock: 0,
      },
    ]);
  });
});

describe('Short-link destination safety', () => {
  it('allows public HTTP(S) destinations and rejects unsafe schemes or credentials', () => {
    expect(isSafePublicHttpUrl('https://www.amazon.in/dp/B0D3G78JKL')).toBe(true);
    expect(isSafePublicHttpUrl('https://[2606:4700:4700::1111]/')).toBe(true);
    expect(isSafePublicHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafePublicHttpUrl('https://user:pass@example.com/path')).toBe(false);
  });

  it('rejects private, reserved, and loopback IPv4 destinations', () => {
    for (const host of [
      '0.1.2.3',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.31.255.255',
      '192.168.1.1',
      '198.18.0.1',
      '203.0.113.1',
      '224.0.0.1',
      '2130706433',
    ]) {
      expect(isSafePublicHttpUrl(`http://${host}/`), host).toBe(false);
    }
    expect(isSafePublicHttpUrl('http://172.32.0.1/')).toBe(true);
  });

  it('rejects local and documentation IPv6 destinations', () => {
    for (const host of ['[::]', '[::1]', '[fc00::1]', '[fd12::1]', '[fe80::1]', '[ff02::1]', '[2001:db8::1]']) {
      expect(isSafePublicHttpUrl(`https://${host}/`), host).toBe(false);
    }
  });
});

describe('Creator-provided page URLs', () => {
  it('keeps local paths on the app origin and allows external HTTP(S) links', () => {
    expect(safePublicHref('/about?from=bio', 'https://creatorbrain.example')).toBe('/about?from=bio');
    expect(safePublicHref('https://instagram.com/creator', 'https://creatorbrain.example')).toBe(
      'https://instagram.com/creator'
    );
  });

  it('rejects script, protocol-relative, and parser-confusion URLs', () => {
    for (const value of [
      'javascript:alert(1)',
      '//evil.example/path',
      '/\\\\evil.example/path',
      'data:text/html,hello',
    ]) {
      expect(safePublicHref(value, 'https://creatorbrain.example'), value).toBe('#');
    }
  });
});

describe('Short-link edge cache', () => {
  it('stores validated redirect metadata with expiry-aware TTLs', () => {
    const link = {
      id: 'link_1',
      creator_id: 'creator_1',
      slug: 'launch',
      destination_url: 'https://example.com/video',
      destination_domain: 'example.com',
      expires_at: '2026-11-15T12:02:00.000Z',
      total_clicks: 0,
      created_at: '2026-11-15T12:00:00.000Z',
    };
    const encoded = serializeShortLinkCache(link);
    expect(parseShortLinkCache(encoded)).toMatchObject({
      version: 2,
      id: 'link_1',
      slug: 'launch',
      creator_id: 'creator_1',
      destination_url: 'https://example.com/video',
      expires_at: '2026-11-15T12:02:00.000Z',
    });
    expect(shortLinkCacheTtl(link.expires_at, Date.parse('2026-11-15T12:00:00.000Z'))).toBe(120);
    expect(shortLinkCacheTtl('2026-11-15T12:00:59.000Z', Date.parse('2026-11-15T12:00:00.000Z'))).toBeNull();
    expect(shortLinkCacheTtl(undefined)).toBe(86_400);
    expect(parseShortLinkCache('https://example.com/video')).toBeNull();
  });
});
