CREATE TABLE IF NOT EXISTS account_recovery_codes (
  code_hash TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_codes_creator ON account_recovery_codes(creator_id);
