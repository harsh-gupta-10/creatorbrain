-- Migration 0004: per-video deep study and encrypted Amazon credentials

-- Every studied video or post keeps its transcript and analysis
ALTER TABLE content_items ADD COLUMN duration_seconds INTEGER;
ALTER TABLE content_items ADD COLUMN comments INTEGER DEFAULT 0;
ALTER TABLE content_items ADD COLUMN tags_json TEXT;               -- creator's own tags or keywords
ALTER TABLE content_items ADD COLUMN transcript TEXT;              -- JSON [{start, text}] or caption text
ALTER TABLE content_items ADD COLUMN transcript_source TEXT;       -- 'captions-manual', 'captions-auto', 'gemini', 'caption-text', 'none'
ALTER TABLE content_items ADD COLUMN thumbnail_analysis_json TEXT;
ALTER TABLE content_items ADD COLUMN analysis_json TEXT;
ALTER TABLE content_items ADD COLUMN analysis_status TEXT DEFAULT 'pending'; -- 'pending', 'done', 'failed'
ALTER TABLE content_items ADD COLUMN analysis_error TEXT;
ALTER TABLE content_items ADD COLUMN analyzed_by TEXT;             -- which engine produced the analysis
ALTER TABLE content_items ADD COLUMN analyzed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(creator_id, analysis_status);

-- Graph nodes can point at the content item they came from
ALTER TABLE nodes ADD COLUMN content_item_id TEXT REFERENCES content_items(id) ON DELETE CASCADE;

-- Amazon tracking IDs are now encrypted per creator; never keep them in monetization JSON
UPDATE creators SET monetization_json = json_remove(monetization_json, '$.partnerTag')
WHERE monetization_json IS NOT NULL AND json_valid(monetization_json);

-- Keys sealed with the previous scheme (shared IV, static salt) cannot be trusted; creators re-enter them
UPDATE credentials_encrypted SET amazon_access_key_enc = NULL, amazon_secret_key_enc = NULL, iv = NULL
WHERE amazon_access_key_enc IS NOT NULL AND amazon_access_key_enc NOT LIKE 'v1:%';
