import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { amazonClientFor } from '../amazon/credentials';
import { z } from 'zod';
import type { Product } from '../../shared/types';

export const amazonRoutes = new Hono<AppEnv>();

const ImportSchema = z.object({
  asin: z.string().regex(/^[A-Z0-9]{10}$/i, 'Invalid ASIN'),
  title: z.string().min(1).max(400),
  price_str: z.string().max(60).default(''),
  price_timestamp: z.string().max(60).default(''),
  currency: z.string().max(8).default('USD'),
  image_url: z.string().url().or(z.literal('')).default(''),
  product_url: z.string().url(),
  features_json: z.string().max(8000).optional(),
  specs_json: z.string().max(8000).optional(),
  pros_cons_json: z.string().max(8000).optional(),
  is_mock: z.number().int().min(0).max(1).default(1),
  availability: z.string().max(80).optional(),
});

function isAmazonUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && /(^|\.)amazon\.(com|in|co\.uk|de|ca)$|(^|\.)amzn\.to$/.test(u.hostname);
  } catch {
    return false;
  }
}

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
  const results = await client.searchItems(query, creator.id);

  return c.json({
    results,
    isMock: client.isMock() || results.some((r) => r.is_mock),
    liveError: client.lastError,
    query,
    marketplace: client.getMarketplace(),
  });
});

// Import product to library
amazonRoutes.post('/import', async (c) => {
  const creator = c.get('creator');

  const parsed = ImportSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Invalid product' }, 400);
  const product = {
    ...parsed.data,
    id: `prod_${parsed.data.asin.toLowerCase()}`,
    creator_id: creator.id,
    created_at: new Date().toISOString(),
  } as Product;

  const dbClient = new DBClient(c.env.DB);
  await dbClient.saveProduct(product);

  return c.json({ success: true, product });
});

// Build tracked affiliate link with partner tag and disclosure
amazonRoutes.post('/build-link', async (c) => {
  const creator = c.get('creator');

  const { productUrl, customTag } = await c.req.json().catch(() => ({}));
  if (!isAmazonUrl(productUrl)) return c.json({ error: 'Paste an Amazon product URL' }, 400);
  if (customTag && !/^[\w-]{3,40}$/.test(customTag)) return c.json({ error: 'Tracking IDs use letters, numbers and dashes' }, 400);
  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  const taggedUrl = client.buildAffiliateUrl(productUrl, customTag);

  return c.json({
    taggedUrl,
    disclosure: client.getMandatoryDisclosure(),
    tag: customTag || client.getPartnerTag(),
  });
});

// Get earnings & CSV manual import
amazonRoutes.get('/earnings', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const earnings = await dbClient.getEarningsReports(creator.id);

  const totalRevenue = earnings.reduce((acc, e) => acc + (e.revenue || 0), 0);
  const totalCommission = earnings.reduce((acc, e) => acc + (e.commission || 0), 0);
  const totalItems = earnings.reduce((acc, e) => acc + (e.items_ordered || 0), 0);

  return c.json({
    earnings,
    summary: {
      totalRevenue,
      totalCommission,
      totalItems,
    },
  });
});

amazonRoutes.post('/earnings/import-csv', async (c) => {
  const creator = c.get('creator');

  const { csvText } = await c.req.json();
  if (!csvText) return c.json({ error: 'CSV text is required' }, 400);

  const lines = csvText.trim().split('\n');
  const rows: Array<{
    report_date: string;
    asin: string;
    product_title: string;
    items_ordered: number;
    items_shipped: number;
    revenue: number;
    commission: number;
  }> = [];

  // Parse lines: Date, ASIN, Product Title, Items Ordered, Items Shipped, Revenue, Commission
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s: string) => s.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 4) {
      rows.push({
        report_date: parts[0] || new Date().toISOString().slice(0, 10),
        asin: parts[1] || 'UNKNOWN',
        product_title: parts[2] || 'Imported Product',
        items_ordered: parseInt(parts[3]) || 1,
        items_shipped: parseInt(parts[4]) || 1,
        revenue: parseFloat(parts[5]) || 0,
        commission: parseFloat(parts[6]) || 0,
      });
    }
  }

  const dbClient = new DBClient(c.env.DB);
  const importedCount = await dbClient.importEarnings(creator.id, rows);

  return c.json({ success: true, importedCount });
});

// Link health check (cron or manual)
amazonRoutes.post('/health-check', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const products = await dbClient.getProducts(creator.id);

  const client = await amazonClientFor(c.env.DB, c.env, creator.id);
  if (client.isMock()) {
    return c.json({ success: true, checkedCount: 0, status: 'Add your Amazon API keys in Settings to check live prices and stock' });
  }
  // Re-query each saved product (bounded to stay under the free tier subrequest limit)
  const now = new Date().toISOString();
  let checked = 0;
  for (const p of products.slice(0, 10)) {
    const [fresh] = await client.getItems([p.asin], creator.id);
    if (fresh && !fresh.is_mock) {
      await dbClient.saveProduct({ ...p, price_str: fresh.price_str, availability: fresh.availability, price_timestamp: fresh.price_timestamp, last_checked_at: now, is_mock: 0 });
      checked++;
    }
  }
  return c.json({
    success: true,
    checkedCount: checked,
    status: client.lastError ? `Amazon returned an error: ${client.lastError}` : `Updated ${checked} of ${products.length} products`,
  });
});
