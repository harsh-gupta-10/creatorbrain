import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';

/** Brand deal pipeline: talking → agreed → posted → paid */
export const dealsRoutes = new Hono<AppEnv>();

interface BrandDealRow {
  id: string;
  creator_id: string;
  brand: string;
  contact: string | null;
  deliverable: string | null;
  amount: number;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD';
  stage: (typeof DEAL_STAGES)[number];
  due_date: string | null;
  post_date: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEAL_STAGES = ['talking', 'agreed', 'posted', 'paid'] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31')
  .or(z.literal(''))
  .optional()
  .transform((v) => v || null);

export const DealSchema = z.object({
  brand: z.string().trim().min(1, 'Enter the brand name').max(80),
  contact: z.string().trim().max(120).optional().default(''),
  deliverable: z.string().trim().max(200).optional().default(''),
  amount: z.coerce.number().min(0, 'Amount cannot be negative').max(100_000_000).default(0),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'CAD']).default('USD'),
  stage: z.enum(DEAL_STAGES).default('talking'),
  due_date: date,
  post_date: date,
  notes: z.string().trim().max(1000).optional().default(''),
});

dealsRoutes.get('/', async (c) => {
  const creator = c.get('creator');
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM brand_deals WHERE creator_id = ? ORDER BY
       CASE stage WHEN 'talking' THEN 0 WHEN 'agreed' THEN 1 WHEN 'posted' THEN 2 ELSE 3 END,
       COALESCE(due_date, '9999') ASC, created_at DESC LIMIT 200`
  )
    .bind(creator.id)
    .all();
  return c.json({ deals: results || [] });
});

dealsRoutes.post('/', async (c) => {
  const creator = c.get('creator');
  const parsed = DealSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const d = parsed.data;
  const id = `deal_${crypto.randomUUID()}`;
  const ts = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO brand_deals (id, creator_id, brand, contact, deliverable, amount, currency, stage, due_date, post_date, notes, paid_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      creator.id,
      d.brand,
      d.contact,
      d.deliverable,
      d.amount,
      d.currency,
      d.stage,
      d.due_date,
      d.post_date,
      d.notes,
      d.stage === 'paid' ? ts : null,
      ts,
      ts
    )
    .run();
  const deal = await c.env.DB.prepare('SELECT * FROM brand_deals WHERE id = ?').bind(id).first();
  return c.json({ deal }, 201);
});

dealsRoutes.patch('/:id', async (c) => {
  const creator = c.get('creator');
  const parsed = DealSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const existing = await c.env.DB.prepare('SELECT * FROM brand_deals WHERE id = ? AND creator_id = ?')
    .bind(c.req.param('id'), creator.id)
    .first<BrandDealRow>();
  if (!existing) return c.json({ error: 'Deal not found' }, 404);

  const next = { ...existing, ...parsed.data };
  const ts = new Date().toISOString();
  const paidAt = next.stage === 'paid' ? existing.paid_at || ts : null;
  await c.env.DB.prepare(
    `UPDATE brand_deals SET brand = ?, contact = ?, deliverable = ?, amount = ?, currency = ?, stage = ?, due_date = ?, post_date = ?,
       notes = ?, paid_at = ?, updated_at = ? WHERE id = ? AND creator_id = ?`
  )
    .bind(
      next.brand,
      next.contact,
      next.deliverable,
      next.amount,
      next.currency,
      next.stage,
      next.due_date,
      next.post_date,
      next.notes,
      paidAt,
      ts,
      existing.id,
      creator.id
    )
    .run();
  const deal = await c.env.DB.prepare('SELECT * FROM brand_deals WHERE id = ?').bind(existing.id).first();
  return c.json({ deal });
});

dealsRoutes.delete('/:id', async (c) => {
  const creator = c.get('creator');
  const res = await c.env.DB.prepare('DELETE FROM brand_deals WHERE id = ? AND creator_id = ?')
    .bind(c.req.param('id'), creator.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Deal not found' }, 404);
  return c.json({ success: true });
});
