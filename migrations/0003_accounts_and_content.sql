-- Migration 0003: real accounts, onboarding profile and studied content

ALTER TABLE creators ADD COLUMN password_salt TEXT;
ALTER TABLE creators ADD COLUMN onboarding_status TEXT DEFAULT 'ready'; -- 'profile', 'study', 'ready'
ALTER TABLE creators ADD COLUMN youtube_input TEXT;
ALTER TABLE creators ADD COLUMN youtube_channel_id TEXT;
ALTER TABLE creators ADD COLUMN instagram_handle TEXT;
ALTER TABLE creators ADD COLUMN content_language TEXT;
ALTER TABLE creators ADD COLUMN upload_cadence TEXT;
ALTER TABLE creators ADD COLUMN goals_json TEXT;        -- JSON array of goal keys
ALTER TABLE creators ADD COLUMN monetization_json TEXT; -- JSON { amazon: bool, partnerTag, marketplace, other: [] }
ALTER TABLE creators ADD COLUMN last_studied_at TEXT;

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,          -- 'youtube', 'instagram'
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (creator_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_content_items_creator ON content_items(creator_id, published_at);

-- The seeded sample creator is complete; anyone else created before this migration is treated as ready too
UPDATE creators SET onboarding_status = 'ready' WHERE onboarding_status IS NULL;

-- Sample workspace uploads (read-only demo creator)
INSERT OR IGNORE INTO content_items (id, creator_id, platform, external_id, title, description, url, thumbnail_url, views, likes, published_at, created_at, updated_at) VALUES
('ci_sample_01','creator_demo_tech_kabir','youtube','s01','CMF Phone 1 teardown: why nobody else built this','Removing the back screws and testing the modular accessories with real multimeter readings.','','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=320&q=70',215000,9800,'2026-08-10T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_02','creator_demo_tech_kabir','youtube','s02','Best phone under ₹15,000 right now: 4 tested','Battery, camera and thermal tests on four budget phones.','','https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=320&q=70',88400,3900,'2026-08-24T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_03','creator_demo_tech_kabir','youtube','s03','Sony WH-1000XM5 in 2026: still worth it?','Frequency response test and ANC demo on the Delhi metro.','','https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=320&q=70',95400,4100,'2026-09-15T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_04','creator_demo_tech_kabir','youtube','s04','I used a ₹9,999 smartwatch for 30 days','Sleep tracking, GPS accuracy and battery over a month.','','https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=320&q=70',61200,2500,'2026-09-29T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_05','creator_demo_tech_kabir','youtube','s05','Motorola Edge 50 Fusion vs Vivo T3 Pro: which ₹22,000 phone','Full camera and battery comparison. Prices in the description are dated.','','https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=320&q=70',148200,6200,'2026-10-20T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_06','creator_demo_tech_kabir','youtube','s06','Budget mechanical keyboards: 3 that feel expensive','Switch sound tests and build quality on three keyboards under ₹4,000.','','https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=320&q=70',54800,2300,'2026-10-27T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_07','creator_demo_tech_kabir','youtube','s07','Apple M4 Mac mini after 10 days: the ₹59,900 truth','Is 16GB enough for 4K editing? Thermals and export times.','','https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=320&q=70',312000,14100,'2026-11-02T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z'),
('ci_sample_08','creator_demo_tech_kabir','youtube','s08','My desk setup for 2026, every item linked','Monitor arm, lights, mic and cables, with what I would skip.','','https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=320&q=70',73900,3300,'2026-11-09T12:00:00Z','2026-11-14T00:00:00Z','2026-11-14T00:00:00Z');

UPDATE creators SET last_studied_at = '2026-11-14T06:00:00Z', upload_cadence = 'weekly', content_language = 'English and Hindi',
  monetization_json = '{"amazon":true,"partnerTag":"techkabir-21","marketplace":"amazon.in","other":["Brand sponsorships"]}'
WHERE id = 'creator_demo_tech_kabir';
