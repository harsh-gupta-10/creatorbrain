-- CreatorBrain D1 Database Schema
-- Migration 0001: Initial Schema

CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  channel_title TEXT,
  channel_url TEXT,
  platform TEXT DEFAULT 'youtube', -- 'youtube', 'instagram', 'both'
  subscribers INTEGER DEFAULT 0,
  avatar_url TEXT,
  bio TEXT,
  niche TEXT DEFAULT 'Tech & Gadgets',
  dna_summary TEXT, -- Synthesized JSON string
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'Style', 'Strength', 'Gap', 'Audience', 'Concept', 'Topic'
  label TEXT NOT NULL,
  description TEXT,
  confidence REAL DEFAULT 1.0,
  evidence_video_ids TEXT, -- JSON array of strings
  meta TEXT, -- JSON string
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relation TEXT NOT NULL, -- 'STRONG_AT', 'NEEDS_WORK', 'LEARNED_FROM', 'RELATES_TO'
  weight REAL DEFAULT 1.0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learnings (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  insight TEXT NOT NULL,
  source_agent TEXT NOT NULL, -- 'Memory Curator', 'Assessor', 'Tutor', 'Packaging Analyst'
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  gap_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Packaging', 'Voice', 'Retention', 'SEO', 'Compliance'
  duration_min INTEGER DEFAULT 5,
  content_markdown TEXT NOT NULL,
  completed INTEGER DEFAULT 0, -- 0 or 1
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  gap_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  questions_json TEXT NOT NULL, -- 5 questions with options, correctIndex, explanation
  score INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed'
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_traces (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  task_description TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  total_steps INTEGER NOT NULL,
  tool_called TEXT,
  tool_input TEXT,
  tool_result TEXT,
  output_summary TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'running', 'failed'
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  channel_url TEXT NOT NULL,
  status TEXT NOT NULL, -- 'queued', 'running', 'completed', 'failed'
  current_step TEXT NOT NULL,
  progress_percent INTEGER DEFAULT 0,
  error_message TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idea', -- 'Idea', 'Scripted', 'Filmed', 'Edited', 'Published'
  brief TEXT NOT NULL,
  primary_product_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'titles', 'description', 'tags', 'pinned_comment', 'shorts_caption', 'instagram_caption', 'script_outline', 'thumbnail_ideas', 'community_post', 'compliance_report'
  current_version_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  prompt_trigger TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  asin TEXT NOT NULL,
  title TEXT NOT NULL,
  price_str TEXT NOT NULL,
  price_timestamp TEXT NOT NULL, -- 'price as of YYYY-MM-DD HH:mm:ss IST'
  currency TEXT DEFAULT 'INR',
  image_url TEXT NOT NULL,
  product_url TEXT NOT NULL,
  features_json TEXT, -- JSON array of strings
  specs_json TEXT, -- JSON object
  pros_cons_json TEXT, -- JSON object { pros: [], cons: [] }
  is_mock INTEGER DEFAULT 1,
  availability TEXT DEFAULT 'In Stock',
  last_checked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  tracking_id TEXT NOT NULL,
  original_url TEXT NOT NULL,
  tagged_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  destination_domain TEXT NOT NULL,
  title TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  expires_at TEXT,
  total_clicks INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id TEXT PRIMARY KEY,
  short_link_id TEXT REFERENCES short_links(id) ON DELETE CASCADE,
  bio_block_id TEXT,
  creator_id TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  device TEXT DEFAULT 'Desktop',
  referrer TEXT DEFAULT 'Direct',
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bio_pages (
  id TEXT PRIMARY KEY,
  creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  handle TEXT UNIQUE NOT NULL,
  theme TEXT DEFAULT 'dna-accent', -- 'dna-accent', 'minimal-dark', 'cyber-neon', 'warm-editorial'
  custom_title TEXT,
  custom_bio TEXT,
  accent_color TEXT DEFAULT '#6366f1',
  bg_color TEXT DEFAULT '#0f172a',
  is_published INTEGER DEFAULT 1,
  views_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bio_blocks (
  id TEXT PRIMARY KEY,
  bio_page_id TEXT NOT NULL REFERENCES bio_pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'link', 'product_card', 'social_links', 'text', 'divider'
  order_index INTEGER NOT NULL,
  title TEXT,
  url TEXT,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  content_json TEXT,
  is_active INTEGER DEFAULT 1,
  clicks_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_settings (
  id TEXT PRIMARY KEY,
  creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  preferred_general_provider TEXT DEFAULT 'claude',
  preferred_fast_provider TEXT DEFAULT 'claude-haiku',
  preferred_structured_provider TEXT DEFAULT 'openai',
  preferred_video_provider TEXT DEFAULT 'gemini',
  daily_budget_usd REAL DEFAULT 5.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials_encrypted (
  id TEXT PRIMARY KEY,
  creator_id TEXT UNIQUE NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  amazon_access_key_enc TEXT,
  amazon_secret_key_enc TEXT,
  amazon_partner_tag TEXT,
  amazon_marketplace TEXT DEFAULT 'amazon.in',
  iv TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS earnings_reports (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  report_date TEXT NOT NULL,
  asin TEXT,
  product_title TEXT,
  items_ordered INTEGER DEFAULT 0,
  items_shipped INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  commission REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Indexes for lightning fast lookups & zero waterfalls
CREATE INDEX IF NOT EXISTS idx_creators_handle ON creators(handle);
CREATE INDEX IF NOT EXISTS idx_sessions_creator ON sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_nodes_creator ON nodes(creator_id);
CREATE INDEX IF NOT EXISTS idx_edges_creator ON edges(creator_id);
CREATE INDEX IF NOT EXISTS idx_learnings_creator ON learnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_lessons_creator ON lessons(creator_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_creator ON agent_traces(creator_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_creator ON analysis_jobs(creator_id);
CREATE INDEX IF NOT EXISTS idx_projects_creator ON projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_creator ON assets(creator_id);
CREATE INDEX IF NOT EXISTS idx_asset_versions_asset ON asset_versions(asset_id);
CREATE INDEX IF NOT EXISTS idx_products_creator ON products(creator_id);
CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_creator ON affiliate_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_short_links_slug ON short_links(slug);
CREATE INDEX IF NOT EXISTS idx_short_links_creator ON short_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(short_link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_creator ON link_clicks(creator_id);
CREATE INDEX IF NOT EXISTS idx_bio_pages_handle ON bio_pages(handle);
CREATE INDEX IF NOT EXISTS idx_bio_blocks_page ON bio_blocks(bio_page_id);
CREATE INDEX IF NOT EXISTS idx_earnings_creator ON earnings_reports(creator_id);
