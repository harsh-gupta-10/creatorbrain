import { afterEach, expect, it, vi } from 'vitest';
import { AmazonCreatorsClient } from '../src/worker/amazon/client';

afterEach(() => vi.unstubAllGlobals());

it('resolves an exact ASIN using the configured marketplace and preserves Amazon attribution', async () => {
  const asin = 'B012345678';
  const catalogUrl = 'https://www.amazon.in/dp/' + asin + '?linkCode=ogi&th=1';
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json({ itemsResult: { items: [{ asin, detailPageURL: catalogUrl }] } }));
  vi.stubGlobal('fetch', request);
  const client = new AmazonCreatorsClient({
    credentialId: 'fixture-id',
    credentialSecret: 'fixture-secret',
    credentialVersion: '3.2',
    marketplace: 'amazon.in',
    partnerTag: 'fixture-21',
  });
  const [product] = await client.getItems([asin], 'creator-test');
  const [endpoint, init] = request.mock.calls[1];
  expect(endpoint).toBe('https://creatorsapi.amazon/catalog/v1/getItems');
  expect(JSON.parse(init.body)).toMatchObject({
    itemIds: [asin],
    partnerTag: 'fixture-21',
    marketplace: 'www.amazon.in',
  });
  expect(product.is_mock).toBe(0);
  const link = new URL(client.buildAffiliateUrl(product.product_url));
  expect([...link.searchParams.entries()]).toEqual([
    ['linkCode', 'ogi'],
    ['th', '1'],
    ['tag', 'fixture-21'],
  ]);
});

it('surfaces catalog eligibility without returning sample listings', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 }))
    .mockResolvedValueOnce(
      Response.json({ type: 'AccessDeniedException', reason: 'AssociateNotEligible' }, { status: 403 })
    );
  vi.stubGlobal('fetch', request);
  const client = creatorsClient('eligibility');
  expect(await client.searchItems('fixture camera', 'creator-test')).toEqual([]);
  expect(request.mock.calls[0][0]).toBe('https://api.amazon.co.uk/auth/o2/token');
  expect(client.lastErrorCode).toBe('AssociateNotEligible');
  expect(client.lastError).toContain('not eligible for live catalog access');
});

function creatorsClient(fixture: string) {
  return new AmazonCreatorsClient({
    credentialId: fixture,
    credentialSecret: 'fixture-secret',
    credentialVersion: '3.2',
    marketplace: 'amazon.in',
    partnerTag: 'fixture-21',
  });
}

it('maps products, variations, browse categories and reporting from the official API shapes', async () => {
  const asin = 'B012345678';
  const item = {
    asin,
    itemInfo: { title: { displayValue: 'A fixture product' } },
    offersV2: { listings: [{ price: { money: { displayAmount: '₹1,000.00', currency: 'INR' } } }] },
  };
  const report = { filename: 'fixture.tsv', reportType: 'CREATOR_CENTRAL' };
  const url = 'https://example-bucket.s3.eu-west-1.amazonaws.com/fixture.tsv?X-Amz-Signature=fixture';
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'fixture-token' }))
    .mockResolvedValueOnce(Response.json({ searchResult: { items: [item] } }))
    .mockResolvedValueOnce(Response.json({ variationsResult: { items: [item] } }))
    .mockResolvedValueOnce(
      Response.json({ browseNodesResult: { browseNodes: [{ id: '123', displayName: 'Kitchen' }] } })
    )
    .mockResolvedValueOnce(Response.json({ reports: [] }))
    .mockResolvedValueOnce(Response.json({ reports: [report] }))
    .mockResolvedValueOnce(Response.json({ url }))
    .mockResolvedValueOnce(Response.json({ url: 'https://untrusted.example/fixture.tsv' }));
  vi.stubGlobal('fetch', request);
  const client = creatorsClient('all-operations');
  expect(await client.searchItems('fixture', 'creator-test')).toMatchObject([
    { asin, currency: 'INR', price_str: '₹1,000.00' },
  ]);
  expect(await client.getVariations(asin, 'creator-test', 1)).toMatchObject([{ asin }]);
  expect(await client.getBrowseNodes(['123'])).toEqual([{ id: '123', displayName: 'Kitchen' }]);
  expect(await client.listReports()).toEqual([]);
  expect(await client.listReports()).toEqual([report]);
  expect(await client.getReportDownload(report.filename)).toBe(url);
  await expect(client.getReportDownload(report.filename)).rejects.toThrow('Amazon could not complete this request');
  expect(request.mock.calls.map(([endpoint]) => endpoint.split('/').at(-1))).toEqual([
    'token',
    'searchItems',
    'getVariations',
    'getBrowseNodes',
    'listReports',
    'listReports',
    'getReport',
    'getReport',
  ]);
  expect(request.mock.calls[4][1].body).toBeUndefined();
  expect(JSON.parse(request.mock.calls[6][1].body)).toEqual({ filename: 'fixture.tsv' });
});
