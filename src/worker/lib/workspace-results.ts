import type { z } from 'zod';

export class WorkspaceResultBusy extends Error {
  constructor() {
    super('This request is already running. Try again shortly to open the saved result.');
  }
}

export async function workspaceDigest(input: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Reuse only successful, validated results for exactly the same creator and inputs. */
export async function reuseWorkspaceResult<T>(
  db: D1Database,
  creatorId: string,
  operation: string,
  inputs: unknown,
  schema: z.ZodType<T>,
  generate: () => Promise<T>,
  lifetimeSeconds = 604800
): Promise<{ value: T; reused: boolean }> {
  const key = operation + ':' + (await workspaceDigest(inputs));
  const now = Math.floor(Date.now() / 1000);
  const lease = crypto.randomUUID();
  const existing = db
    .prepare('SELECT result,lease FROM workspace_results WHERE creator_id=? AND cache_key=? AND expires_at>?')
    .bind(creatorId, key, now);
  const read = async () => {
    const row = await existing.first<{ result: string | null; lease: string }>();
    if (!row) return null;
    if (row.result === null) throw new WorkspaceResultBusy();
    let raw: unknown;
    try {
      raw = JSON.parse(row.result);
    } catch {
      raw = undefined;
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      await db
        .prepare('DELETE FROM workspace_results WHERE creator_id=? AND cache_key=? AND lease=?')
        .bind(creatorId, key, row.lease)
        .run();
      return null;
    }
    return { value: parsed.data, reused: true };
  };
  const cached = await read();
  if (cached) return cached;

  const claim = await db
    .prepare(
      `INSERT INTO workspace_results (creator_id,cache_key,lease,result,expires_at) VALUES (?,?,?,NULL,?)
     ON CONFLICT(creator_id,cache_key) DO UPDATE SET lease=excluded.lease,result=NULL,expires_at=excluded.expires_at
     WHERE workspace_results.expires_at<=?`
    )
    .bind(creatorId, key, lease, now + 180, now)
    .run();
  if (!claim.meta.changes) {
    const result = await read();
    if (result) return result;
    throw new WorkspaceResultBusy();
  }

  try {
    const value = schema.parse(await generate());
    const result = JSON.stringify(value);
    if (result.length <= 64_000) {
      await db
        .prepare('UPDATE workspace_results SET result=?,expires_at=? WHERE creator_id=? AND cache_key=? AND lease=?')
        .bind(result, Math.floor(Date.now() / 1000) + lifetimeSeconds, creatorId, key, lease)
        .run();
    } else {
      await db
        .prepare('DELETE FROM workspace_results WHERE creator_id=? AND cache_key=? AND lease=?')
        .bind(creatorId, key, lease)
        .run();
    }
    return { value, reused: false };
  } catch (error) {
    await db
      .prepare('DELETE FROM workspace_results WHERE creator_id=? AND cache_key=? AND lease=?')
      .bind(creatorId, key, lease)
      .run()
      .catch(() => {});
    throw error;
  }
}
