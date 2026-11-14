-- Migration 0006: saved conversations (Copilot, Studio per project, Tutor, Quick tools)

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  thread TEXT NOT NULL,          -- 'copilot', 'tutor', 'studio:<projectId>', 'tools:<toolType>'
  role TEXT NOT NULL,            -- 'user', 'assistant'
  content TEXT NOT NULL,
  meta_json TEXT,                -- extra UI data, e.g. detected product or proposed project
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(creator_id, thread, created_at);
