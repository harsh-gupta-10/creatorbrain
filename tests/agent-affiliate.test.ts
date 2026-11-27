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
