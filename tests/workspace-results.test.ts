import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Creator, ProjectAsset } from '../src/shared/types';
import type { Env } from '../src/worker/env';
import { reviewScript } from '../src/worker/lib/project-workflows';
import { reuseWorkspaceResult, WorkspaceResultBusy } from '../src/worker/lib/workspace-results';

const databases: DatabaseSync[] = [];
function cacheDatabase() {
  const sql = new DatabaseSync(':memory:');
  databases.push(sql);
  sql.exec(`CREATE TABLE workspace_results (
    creator_id TEXT NOT NULL, cache_key TEXT NOT NULL, lease TEXT NOT NULL,
    result TEXT, expires_at INTEGER NOT NULL, PRIMARY KEY (creator_id,cache_key)
  )`);
  const db = {
    prepare(query: string) {
      const statement = sql.prepare(query);
      return {
        bind(...args: SQLInputValue[]) {
          return {
            async first() {
              return statement.get(...args) ?? null;
            },
            async run() {
              return { meta: { changes: Number(statement.run(...args).changes) } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, sql };
}
afterEach(() => {
  for (const sql of databases.splice(0)) sql.close();
});

describe('Reusable workspace results', () => {
  it('reuses a validated result only for the same creator, operation and source data', async () => {
    const { db, sql } = cacheDatabase();
    const generate = vi.fn().mockResolvedValue('Private result');
    const call = (owner: string, input: string, operation = 'review-v1') =>
      reuseWorkspaceResult(db, owner, operation, { input }, z.string(), generate);
    expect(await call('alice', 'first draft')).toEqual({ value: 'Private result', reused: false });
    expect(await call('alice', 'first draft')).toEqual({ value: 'Private result', reused: true });
    expect(generate).toHaveBeenCalledOnce();
    expect(await call('bob', 'first draft')).toMatchObject({ reused: false });
    expect(await call('alice', 'edited draft')).toMatchObject({ reused: false });
    expect(await call('alice', 'first draft', 'review-v2')).toMatchObject({ reused: false });
    sql.exec('UPDATE workspace_results SET expires_at=0');
    expect(await call('alice', 'first draft')).toMatchObject({ reused: false });
    expect(generate).toHaveBeenCalledTimes(5);
  });

  it('prevents concurrent duplicate generation and lets a failed computation be retried', async () => {
    const { db } = cacheDatabase();
    const generate = vi.fn();
    let release: (value: string) => void = () => {};
    const inflight = new Promise<string>((resolve) => {
      release = resolve;
    });
    let started: () => void = () => {};
    const whenStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    generate.mockImplementationOnce(() => {
      started();
      return inflight;
    });
    const call = (input: string) => reuseWorkspaceResult(db, 'alice', 'review-v1', input, z.string(), generate);
    const first = call('draft');
    await whenStarted;
    await expect(call('draft')).rejects.toBeInstanceOf(WorkspaceResultBusy);
    release('Saved');
    expect(await first).toEqual({ value: 'Saved', reused: false });
    expect(await call('draft')).toEqual({ value: 'Saved', reused: true });
    expect(generate).toHaveBeenCalledTimes(1);
    generate.mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValueOnce('Recovered');
    await expect(call('another draft')).rejects.toThrow('Provider unavailable');
    expect(await call('another draft')).toEqual({ value: 'Recovered', reused: false });
  });
});

it('reuses script reviews before calling AI and keeps edits attached to actual saved lines', async () => {
  const { db } = cacheDatabase();
  const statements = {
    prepare(query: string) {
      if (query.includes('workspace_results')) return db.prepare(query);
      return {
        bind: () => ({ all: async () => ({ results: [] }), first: async () => null }),
      };
    },
  } as unknown as D1Database;
  const run = vi.fn().mockResolvedValue({
    response: JSON.stringify({
      notes: [
        { line: 2, issue: 'Move the outcome earlier.', replacement: 'Show the radio receiving a signal.' },
        { line: 2, issue: 'Duplicate line.', replacement: 'Discard.' },
        { line: 42, issue: 'Hallucinated line.', replacement: 'Discard.' },
      ],
    }),
  });
  const env = { DB: statements, AI: { run } } as unknown as Env;
  const creator = { id: 'alice', script_language: 'english' } as Creator;
  const project = { title: 'Arduino radio', brief: 'A beginner build.' };
  const asset = { id: 'draft', content: 'Open with the parts.\nShow the signal.' } as ProjectAsset;
  const once = await reviewScript(env, creator, project, asset);
  expect(once).toMatchObject({ reused: false, value: { notes: [{ line: 2, issue: 'Move the outcome earlier.' }] } });
  expect(once.value.notes).toHaveLength(1);
  expect(await reviewScript(env, creator, project, asset)).toEqual({ reused: true, value: once.value });
  expect(run).toHaveBeenCalledOnce();
  expect(
    await reviewScript(env, creator, project, { ...asset, content: 'An edited draft.\nTry the radio.' })
  ).toMatchObject({ reused: false });
  expect(run).toHaveBeenCalledTimes(2);
});
