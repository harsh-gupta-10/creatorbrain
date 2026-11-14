-- Migration 0005: brand deal pipeline

CREATE TABLE IF NOT EXISTS brand_deals (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  contact TEXT,
  deliverable TEXT,
  amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  stage TEXT NOT NULL DEFAULT 'talking', -- 'talking', 'agreed', 'posted', 'paid'
  due_date TEXT,                          -- when payment is due (YYYY-MM-DD)
  post_date TEXT,                         -- when the content goes live (YYYY-MM-DD)
  notes TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brand_deals_creator ON brand_deals(creator_id, stage);

-- A few deals for the read-only sample workspace
INSERT OR IGNORE INTO brand_deals (id, creator_id, brand, contact, deliverable, amount, currency, stage, due_date, post_date, notes, paid_at, created_at, updated_at) VALUES
('deal_sample_1', 'creator_demo_tech_kabir', 'Noise', 'partnerships@example.com', 'Integrated 60s segment in a review', 45000, 'INR', 'paid', '2026-10-30', '2026-10-20', 'Paid on time', '2026-10-28T10:00:00Z', '2026-10-01T10:00:00Z', '2026-10-28T10:00:00Z'),
('deal_sample_2', 'creator_demo_tech_kabir', 'boAt', 'creators@example.com', 'Dedicated Short plus pinned comment', 30000, 'INR', 'posted', '2026-11-10', '2026-11-02', 'Invoice sent Nov 3', NULL, '2026-10-15T10:00:00Z', '2026-11-03T10:00:00Z'),
('deal_sample_3', 'creator_demo_tech_kabir', 'Ambrane', 'marketing@example.com', 'Power bank review, 90s segment', 25000, 'INR', 'agreed', '2026-12-15', '2026-11-25', 'Script due Nov 20', NULL, '2026-11-05T10:00:00Z', '2026-11-05T10:00:00Z'),
('deal_sample_4', 'creator_demo_tech_kabir', 'Portronics', 'hello@example.com', 'Desk setup feature', 0, 'INR', 'talking', NULL, NULL, 'Asked for rate card', NULL, '2026-11-12T10:00:00Z', '2026-11-12T10:00:00Z');
