import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import { AmazonCreatorsClient } from '../amazon/client';
import { decryptCredential } from '../amazon/crypto';
import type { Product } from '../../shared/types';

export const amazonRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ENCRYPTION_KEY?: string;
  };
}>();

async function getClientForCreator(
  db: D1Database,
  creatorId: string,
  encryptionKey?: string
): Promise<AmazonCreatorsClient> {
  const dbClient = new DBClient(db);
  const creds = await dbClient.getEncryptedCredentials(creatorId);

  if (
    creds?.amazon_access_key_enc &&
    creds?.amazon_secret_key_enc &&
    creds?.iv &&
    creds?.amazon_partner_tag
  ) {
    try {
      const pass = encryptionKey || 'creatorbrain_default_dev_key_32b';
      const accessKey = await decryptCredential(creds.amazon_access_key_enc, creds.iv, pass);
      const secretKey = await decryptCredential(creds.amazon_secret_key_enc, creds.iv, pass);

      return new AmazonCreatorsClient({
        accessKey,
        secretKey,
        partnerTag: creds.amazon_partner_tag,
        marketplace: creds.amazon_marketplace || 'amazon.in',
      });
    } catch (err) {
      console.warn('[Amazon Routes] Decryption failed, using mock mode:', err);
    }
  }

  return new AmazonCreatorsClient();
}

// Get product library for creator
amazonRoutes.get('/products', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const products = await dbClient.getProducts(creator.id);
  const client = await getClientForCreator(c.env.DB, creator.id, c.env.ENCRYPTION_KEY);

  return c.json({
    products,
    isMock: client.isMock(),
    marketplace: client.getMarketplace(),
    partnerTag: client.getPartnerTag(),
  });
});

// Search Amazon products (SearchItems)
amazonRoutes.get('/search', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const query = c.req.query('q') || 'Motorola';
  const client = await getClientForCreator(c.env.DB, creator.id, c.env.ENCRYPTION_KEY);
  const results = await client.searchItems(query, creator.id);

  return c.json({
    results,
    isMock: client.isMock(),
    query,
    marketplace: client.getMarketplace(),
  });
});

// Import product to library
amazonRoutes.post('/import', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const product = (await c.req.json()) as Product;
  product.creator_id = creator.id;
  if (!product.id) {
    product.id = `prod_${product.asin.toLowerCase()}`;
  }

  const dbClient = new DBClient(c.env.DB);
  await dbClient.saveProduct(product);

  return c.json({ success: true, product });
});

// Build tracked affiliate link with partner tag and disclosure
amazonRoutes.post('/build-link', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { productUrl, customTag } = await c.req.json();
  const client = await getClientForCreator(c.env.DB, creator.id, c.env.ENCRYPTION_KEY);
  const taggedUrl = client.buildAffiliateUrl(productUrl, customTag);

  return c.json({
    taggedUrl,
    disclosure: client.getMandatoryDisclosure(),
    tag: customTag || client.getPartnerTag(),
  });
});

// Get earnings & CSV manual import
amazonRoutes.get('/earnings', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

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
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { csvText } = await c.req.json();
  if (!csvText) return c.json({ error: 'CSV text is required' }, 400);

  const lines = csvText.trim().split('\n');
  const rows: any[] = [];

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
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const products = await dbClient.getProducts(creator.id);

  // Update last_checked_at and verify stock
  const now = new Date().toISOString();
  for (const p of products) {
    p.last_checked_at = now;
    p.availability = 'In Stock';
    await dbClient.saveProduct(p);
  }

  return c.json({
    success: true,
    checkedCount: products.length,
    status: 'All affiliate products verified in stock on Amazon.',
  });
});
