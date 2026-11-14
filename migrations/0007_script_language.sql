-- Migration 0007: how drafts are written, separate from the language the creator films in
-- 'english' | 'hinglish' (Roman letters) | 'hindi' (Devanagari) | 'match' (same as videos)
ALTER TABLE creators ADD COLUMN script_language TEXT DEFAULT 'english';

-- The sample creator films in a Hindi-English mix and reads drafts in Hinglish
UPDATE creators SET script_language = 'hinglish' WHERE id = 'creator_demo_tech_kabir';
