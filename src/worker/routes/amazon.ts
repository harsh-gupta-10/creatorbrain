import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { amazonClientFor } from '../amazon/credentials';
import { AmazonApiError } from '../amazon/client';
import { ASIN_RE, amazonProductAsin, amazonProductUrl, tagAmazonProduct } from '../../shared/amazon';
import { parseEarningsReport, MAX_REPORT_CHARS } from '../amazon/earnings';
import { z } from 'zod';
import type { Product } from '../../shared/types';

export const amazonRoutes = new Hono<AppEnv>();

const ImportSchema = z.object({ asin: z.string().regex(ASIN_RE, 'Invalid ASIN') });

// Get product library for creator
amazonRoutes.get('/products', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const products = await dbClient.getProducts(creator.id);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);

  return c.json({
    products,
    isMock: client.isMock(),
    marketplace: client.getMarketplace(),
    partnerTag: client.getPartnerTag(),
  });
});

// Search Amazon products (SearchItems)
amazonRoutes.get('/search', async (c) => {
  const creator = c.get('creator');

  const query = (c.req.query('q') || '').trim().slice(0, 200);
  if (query.length < 2) return c.json({ error: 'Enter at least 2 characters to search' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  const variation = c.req.query('mode') === 'variations';
  if (!variation && query.length < 2)
    return c.json({ error: 'Enter a product name, ASIN, or Amazon product URL.' }, 400);
  if (variation && !ASIN_RE.test(query)) return c.json({ error: 'Enter the parent ASIN to find variations.' }, 400);
  const productUrl = amazonProductUrl(query, client.getMarketplace());
  if (!productUrl && /^https?:/i.test(query))
    return c.json({ error: 'Paste an Amazon product URL from your configured marketplace.' }, 400);
  const asin = productUrl && amazonProductAsin(productUrl);
  const results = variation
    ? await client.getVariations(query.toUpperCase(), creator.id, 1)
    : asin
      ? (await client.getItems([asin], creator.id)).filter((p) => p.asin === asin)
      : await client.searchItems(query, creator.id);

  return c.json({
    results,
    isMock: client.isMock() || results.some((r) => r.is_mock),
    liveError: client.lastError,
    code: client.lastErrorCode,
    query,
    marketplace: client.getMarketplace(),
  });
});

// Import product to library
amazonRoutes.post('/import', async (c) => {
  const creator = c.get('creator');

  const parsed = ImportSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Invalid product' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  const asin = parsed.data.asin.toUpperCase();
  const fresh = (await client.getItems([asin], creator.id)).find((item) => !item.is_mock && item.asin === asin);
  if (client.lastError) return c.json({ error: client.lastError, code: client.lastErrorCode }, 422);
  if (!fresh)
    return c.json(
      {
        error:
          'Amazon could not verify this product in your marketplace. You can still build a tagged link from its ASIN.',
      },
      422
    );
  const product: Product = { ...fresh, id: `prod_${creator.id}_${client.getMarketplace()}_${asin}` };

  const dbClient = new DBClient(c.env.DB);
  await dbClient.saveProduct(product);

  return c.json({ success: true, product });
});

// Build tracked affiliate link with partner tag and disclosure
amazonRoutes.post('/build-link', async (c) => {
  const creator = c.get('creator');

  const parsed = z
    .object({
      productUrl: z.string().trim().max(2048),
      customTag: z
        .string()
        .regex(/^[\w-]{3,40}$/)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter an ASIN or Amazon product URL and a valid tracking ID.' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  const tag = parsed.data.customTag || client.getPartnerTag();
  if (!tag) return c.json({ error: 'Save your Associates tracking ID in Settings first.' }, 400);
  const taggedUrl = tagAmazonProduct(parsed.data.productUrl, client.getMarketplace(), tag);
  if (!taggedUrl)
    return c.json(
      {
        error: `Enter an ASIN or full product URL from ${client.getMarketplace()}. For a SiteStripe short link, paste the full product URL instead.`,
      },
      400
    );
  return c.json({ taggedUrl, disclosure: client.getMandatoryDisclosure(), tag });
});

amazonRoutes.get('/catalog/categories', async (c) => {
  const ids = z
    .string()
    .regex(/^\d{1,19}(,\d{1,19}){0,9}$/)
    .safeParse(c.req.query('ids'));
  if (!ids.success) return c.json({ error: 'Enter up to 10 numeric Amazon browse node IDs.' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, c.get('creator').id);
  if (!client.getPartnerTag()) return c.json({ error: 'Save your Associates tracking ID in Settings first.' }, 400);
  try {
    return c.json({ categories: await client.getBrowseNodes(ids.data.split(',')) });
  } catch (e) {
    if (!(e instanceof AmazonApiError)) throw e;
    return c.json({ error: e.message, code: e.code }, 422);
  }
});

amazonRoutes.get('/reports', async (c) => {
  const client = await amazonClientFor(c.env.DB, c.env, c.get('creator').id);
  if (!client.hasCreatorsCredentials()) return c.json({ configured: false, reports: [] });
  try {
    return c.json({ configured: true, reports: await client.listReports() });
  } catch (e) {
    if (!(e instanceof AmazonApiError)) throw e;
    return c.json({ error: e.message, code: e.code }, 422);
  }
});

amazonRoutes.post('/reports/download', async (c) => {
  const parsed = z.object({ filename: z.string().min(1).max(512) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Select an Amazon report.' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, c.get('creator').id);
  try {
    const reports = await client.listReports();
    if (!reports.some((report) => report.filename === parsed.data.filename))
      return c.json({ error: 'This report is no longer available.' }, 404);
    return c.json({ url: await client.getReportDownload(parsed.data.filename) });
  } catch (e) {
    if (!(e instanceof AmazonApiError)) throw e;
    return c.json({ error: e.message, code: e.code }, 422);
  }
});

// Get earnings & CSV manual import
amazonRoutes.get('/earnings', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  const marketplace = client.getMarketplace();
  const earnings = await dbClient.getEarningsReports(creator.id, marketplace);

  const totalRevenue = earnings.reduce((acc, e) => acc + (e.revenue || 0), 0);
  const totalCommission = earnings.reduce((acc, e) => acc + (e.commission || 0), 0);
  const totalItems = earnings.reduce((acc, e) => acc + (e.items_shipped || 0), 0);

  return c.json({
    earnings,
    marketplace,
    summary: {
      totalRevenue,
      totalCommission,
      totalItems,
    },
  });
});

amazonRoutes.post('/earnings/import-csv', async (c) => {
  const creator = c.get('creator');

  const parsed = z
    .object({ csvText: z.string().trim().min(1).max(MAX_REPORT_CHARS) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Add a CSV or TSV earnings report under 500,000 characters.' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  const marketplace = client.getMarketplace();
  let rows;
  try {
    rows = parseEarningsReport(parsed.data.csvText, marketplace);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Could not read the earnings report.' }, 400);
  }
  const importedCount = await new DBClient(c.env.DB).importEarnings(creator.id, marketplace, rows);
  return c.json({ success: true, importedCount });
});

// Link health check (cron or manual)
amazonRoutes.post('/health-check', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const products = await dbClient.getProducts(creator.id);

  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  if (client.isMock()) {
    return c.json({
      success: true,
      checkedCount: 0,
      status: 'Add your Amazon API keys in Settings to check live prices and stock',
    });
  }
  const batch = products.filter((p) => !!amazonProductUrl(p.product_url, client.getMarketplace())).slice(0, 10);
  if (!batch.length)
    return c.json({
      success: true,
      checkedCount: 0,
      status: 'Add a product from this marketplace to check its price and availability.',
    });
  const fresh = await client.getItems([...new Set(batch.map((p) => p.asin))], creator.id);
  if (client.lastError) return c.json({ error: client.lastError, code: client.lastErrorCode }, 422);

  const byAsin = new Map(fresh.filter((p) => !p.is_mock).map((p) => [p.asin, p]));
  let checked = 0;
  for (const product of batch) {
    const item = byAsin.get(product.asin);
    if (!item) continue;
    await dbClient.saveProduct({ ...product, ...item, id: product.id, created_at: product.created_at });
    checked++;
  }
  return c.json({
    success: true,
    checkedCount: checked,
    status: `Updated ${checked} of ${batch.length} checked products.`,
  });
});
