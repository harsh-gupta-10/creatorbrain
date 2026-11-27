import { findingKey, readBrainControls } from './creator-planning';
import { WORKSPACE_TOOLS, type ToolMemory, type WorkspaceTool } from '../../shared/chat-suggestions';

export const TOOL_MEMORY_SOURCE = 'Workspace tools';
const TOOL_PREFIX = 'tool_memory:';

export function rememberTool(db: D1Database, creatorId: string, tool: WorkspaceTool) {
  return db
    .prepare(
      `INSERT INTO learnings (id, creator_id, title, insight, source_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at WHERE learnings.creator_id=excluded.creator_id`
    )
    .bind(
      `${TOOL_PREFIX}${tool}:${creatorId}`,
      creatorId,
      WORKSPACE_TOOLS[tool],
      'Used this tool successfully.',
      TOOL_MEMORY_SOURCE,
      new Date().toISOString()
    );
}

export async function readToolMemory(db: D1Database, creatorId: string): Promise<ToolMemory[]> {
  const { results } = await db
    .prepare(
      `SELECT id,created_at FROM learnings
    WHERE creator_id=? AND source_agent=? ORDER BY created_at DESC, id LIMIT 8`
    )
    .bind(creatorId, TOOL_MEMORY_SOURCE)
    .all<{ id: string; created_at: string }>();
  return results.flatMap((row) => {
    const tool = row.id.slice(TOOL_PREFIX.length).split(':', 1)[0];
    return Object.hasOwn(WORKSPACE_TOOLS, tool) ? [{ tool: tool as WorkspaceTool, lastUsedAt: row.created_at }] : [];
  });
}

export async function readWorkspaceEvidence(db: D1Database, creatorId: string) {
  const [signals, learnings, video, links, controls] = await Promise.all([
    db
      .prepare(
        `SELECT type,label,substr(description,1,300) AS description FROM nodes
      WHERE creator_id=? AND type IN ('Strength','Gap','Topic','Style','Hook','Audience')
      ORDER BY confidence DESC, updated_at DESC, id LIMIT 30`
      )
      .bind(creatorId)
      .all<{ type: string; label: string; description: string | null }>(),
    db
      .prepare(
        `SELECT title,substr(insight,1,320) AS insight FROM learnings
      WHERE creator_id=? AND source_agent<>? ORDER BY created_at DESC, id LIMIT 3`
      )
      .bind(creatorId, TOOL_MEMORY_SOURCE)
      .all<{ title: string; insight: string }>(),
    db
      .prepare(
        `SELECT title, views FROM (
      SELECT title,views FROM content_items WHERE creator_id=? AND platform='youtube'
      ORDER BY published_at DESC, id LIMIT 30
    ) WHERE views>0 ORDER BY views DESC,title LIMIT 1`
      )
      .bind(creatorId)
      .first<{ title: string; views: number }>(),
    db
      .prepare(
        `SELECT slug,destination_domain AS domain,total_clicks AS clicks FROM short_links
      WHERE creator_id=? AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))
      ORDER BY total_clicks DESC, created_at DESC, id LIMIT 1`
      )
      .bind(creatorId)
      .first<{ slug: string; domain: string; clicks: number }>(),
    readBrainControls(db, creatorId),
  ]);
  const preferences = controls.filter(({ state }) => state === 'preference').slice(0, 10).map(({ note }) => note);
  const moderated = new Map(controls.map((control) => [control.key, control]));
  const seen = new Set<string>();
  const accepted = [];
  const descriptions = new Map<string, string | null>();
  for (const signal of signals.results) {
    const key = await findingKey(signal.type, signal.label);
    if (seen.has(key)) continue;
    seen.add(key);
    descriptions.set(key, signal.description);
    if (!moderated.has(key)) accepted.push(signal);
  }
  const chosen = controls.filter(({ state }) => state === 'pinned' || state === 'corrected').map(({ key, type, label, note, state }) => ({
    type, label: state === 'corrected' ? note : label, description: state === 'corrected' ? note : descriptions.get(key) ?? null,
  }));
  return {
    signals: [...chosen, ...accepted].slice(0, 8), preferences,
    learnings: learnings.results, topRecentUpload: video, topActiveLink: links,
  };
}
