import type { WorkspaceTool } from '../../shared/chat-suggestions';
import { rememberTool } from './workspace-evidence';

// Saved conversations. Every assistant surface writes here so a refresh or a tab
// change brings the conversation back exactly as it was.

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

export const THREAD_RE = /^(copilot|tutor|studio:[\w-]{1,80}|tools:(hook|script|thumbnail|caption_hashtag))$/;
const MAX_CONTENT = 20_000;
const KEEP_PER_THREAD = 200;

export async function loadThread(
  db: D1Database,
  creatorId: string,
  thread: string,
  limit = 100
): Promise<ChatMessage[]> {
  const { results } = await db
    .prepare(
      `SELECT id, role, content, meta_json, created_at FROM (
         SELECT * FROM chat_messages WHERE creator_id = ? AND thread = ? ORDER BY created_at DESC, id DESC LIMIT ?
       ) ORDER BY created_at ASC, id ASC`
    )
    .bind(creatorId, thread, limit)
    .all<{ id: string; role: 'user' | 'assistant'; content: string; meta_json: string | null; created_at: string }>();
  return (results || []).map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    meta: r.meta_json ? safeParse(r.meta_json) : null,
    created_at: r.created_at,
  }));
}

/** Appends messages in order and trims the thread to its most recent messages */
export async function appendToThread(
  db: D1Database,
  creatorId: string,
  thread: string,
  messages: { role: 'user' | 'assistant'; content: string; meta?: Record<string, unknown> | null }[],
  tool?: WorkspaceTool
): Promise<void> {
  if (!THREAD_RE.test(thread) || !messages.length) return;
  const base = Date.now();
  const stmts = messages.map((m, i) =>
    db
      .prepare(
        'INSERT INTO chat_messages (id, creator_id, thread, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        `msg_${crypto.randomUUID()}`,
        creatorId,
        thread,
        m.role,
        m.content.slice(0, MAX_CONTENT),
        m.meta ? JSON.stringify(m.meta).slice(0, MAX_CONTENT) : null,
        // Millisecond offsets keep the pair in order even within one request
        new Date(base + i).toISOString()
      )
  );
  stmts.push(
    db
      .prepare(
        `DELETE FROM chat_messages WHERE creator_id = ? AND thread = ? AND id NOT IN (
           SELECT id FROM chat_messages WHERE creator_id = ? AND thread = ? ORDER BY created_at DESC LIMIT ${KEEP_PER_THREAD})`
      )
      .bind(creatorId, thread, creatorId, thread)
  );
  if (tool) stmts.push(rememberTool(db, creatorId, tool));
  await db.batch(stmts);
}

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
