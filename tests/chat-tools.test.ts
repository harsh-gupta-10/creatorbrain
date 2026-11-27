import { afterEach, describe, expect, it, vi } from 'vitest';
import { isShortenRequest, runChatTool } from '../src/worker/agents/chat-tools';
import { runQuickTool } from '../src/worker/agents/quick-tools';
import type { Creator } from '../src/shared/types';
import type { Env } from '../src/worker/env';

afterEach(() => vi.restoreAllMocks());

describe('Creator chat tools', () => {
  it.each([
    'i want short link',
    'Make this a short link',
    'Could you shorten this URL?',
    '/shorten https://example.com',
  ])('recognizes the short link request %s', (text) => expect(isShortenRequest(text)).toBe(true));
  it.each(['Write a script about how to create a short link', 'Shorten my captions', 'Do not make a short link'])(
    'keeps non-link requests out of the short link tool: %s',
    (text) => expect(isShortenRequest(text)).toBe(false)
  );

  it('runs the shared Quick Tool and saves its output in the matching tool thread', async () => {
    const bind = vi.fn().mockReturnValue({});
    const db = { prepare: vi.fn().mockReturnValue({ bind }), batch: vi.fn() } as unknown as D1Database;
    const ai = vi.fn().mockResolvedValue({ response: 'Show the reveal first.' });
    const env = { DB: db, AI: { run: ai } } as unknown as Env;
    const creator = { id: 'owner', script_language: 'english' } as Creator;
    for (const command of ['hook', 'script', 'thumbnail', 'captions']) {
      const result = await runChatTool({
        env,
        creator,
        message: `/tool ${command} for a Raspberry Pi build`,
        history: [],
        origin: 'https://creatorbrain.tech',
      });
      expect(result?.reply).toBe('Show the reveal first.');
      expect(
        bind.mock.calls.some((args) => args[2] === `tools:${command === 'captions' ? 'caption_hashtag' : command}`)
      ).toBe(true);
    }
    expect(ai).toHaveBeenCalledTimes(4);
    await expect(
      runQuickTool({ DB: db } as Env, creator, { toolType: 'hook', topic: 'A test topic', platform: 'youtube' })
    ).rejects.toThrow();
  });
});
