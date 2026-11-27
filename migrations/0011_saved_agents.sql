CREATE TABLE saved_agents (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  focus TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  report TEXT,
  last_run TEXT
);
CREATE INDEX saved_agents_owner ON saved_agents(creator_id, name);
