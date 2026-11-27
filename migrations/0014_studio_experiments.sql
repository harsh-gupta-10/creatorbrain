CREATE TABLE studio_experiment_events (
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  experiment_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('seen', 'sent')),
  variant_key TEXT NOT NULL,
  claim TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  delivered_at TEXT,
  PRIMARY KEY (creator_id, experiment_key, event_type)
);

CREATE TABLE flagsmith_approvals (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  experiment_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  revision TEXT NOT NULL,
  expected_winner TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applying','applied','failed')),
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX flagsmith_approvals_creator ON flagsmith_approvals(creator_id, updated_at DESC);
CREATE UNIQUE INDEX flagsmith_approvals_one_change
  ON flagsmith_approvals(environment, experiment_id) WHERE status='applying';
