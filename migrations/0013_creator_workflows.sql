CREATE TABLE workspace_results (
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  lease TEXT NOT NULL,
  result TEXT,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (creator_id, cache_key)
);
CREATE INDEX workspace_results_expiry ON workspace_results(expires_at);

CREATE TABLE project_publications (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE
);

CREATE TABLE video_review_snapshots (
  content_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  views INTEGER NOT NULL,
  sampled_at TEXT NOT NULL,
  age_delta REAL NOT NULL
);
CREATE INDEX video_review_snapshots_creator ON video_review_snapshots(creator_id, sampled_at DESC);

-- Keep the observation closest to day seven within a one-day window on either side.
CREATE TRIGGER video_review_new AFTER INSERT ON content_items
WHEN NEW.platform = 'youtube' AND NEW.views > 0
 AND abs(julianday(NEW.updated_at) - julianday(NEW.published_at) - 7) <= 1
BEGIN
  INSERT INTO video_review_snapshots VALUES
    (NEW.id, NEW.creator_id, NEW.views, NEW.updated_at, abs(julianday(NEW.updated_at) - julianday(NEW.published_at) - 7))
  ON CONFLICT(content_id) DO UPDATE SET views=excluded.views, sampled_at=excluded.sampled_at, age_delta=excluded.age_delta
  WHERE excluded.age_delta <= video_review_snapshots.age_delta;
END;

CREATE TRIGGER video_review_refresh AFTER UPDATE OF views ON content_items
WHEN NEW.platform = 'youtube' AND NEW.views > 0
 AND abs(julianday(NEW.updated_at) - julianday(NEW.published_at) - 7) <= 1
BEGIN
  INSERT INTO video_review_snapshots VALUES
    (NEW.id, NEW.creator_id, NEW.views, NEW.updated_at, abs(julianday(NEW.updated_at) - julianday(NEW.published_at) - 7))
  ON CONFLICT(content_id) DO UPDATE SET views=excluded.views, sampled_at=excluded.sampled_at, age_delta=excluded.age_delta
  WHERE excluded.age_delta <= video_review_snapshots.age_delta;
END;

CREATE TABLE project_link_placements (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('description', 'pinned_comment', 'bio')),
  short_link_id TEXT NOT NULL UNIQUE REFERENCES short_links(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, destination, placement)
);

CREATE TABLE competitor_watch_snapshots (
  agent_id TEXT PRIMARY KEY REFERENCES saved_agents(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  current_json TEXT NOT NULL,
  previous_json TEXT
);

CREATE TABLE brain_memory_controls (
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  label TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pinned', 'dismissed', 'corrected', 'preference')),
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (creator_id, memory_key)
);

CREATE TABLE weekly_plan_snoozes (
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  action_id TEXT NOT NULL,
  until_date TEXT NOT NULL,
  PRIMARY KEY (creator_id, action_id)
);
