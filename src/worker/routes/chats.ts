import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { loadThread, THREAD_RE } from '../lib/chats';

/** Read or clear a saved conversation */
export const chatRoutes = new Hono<AppEnv>();

chatRoutes.get('/:thread', async (c) => {
  const thread = c.req.param('thread');
  if (!THREAD_RE.test(thread)) return c.json({ error: 'Unknown conversation' }, 400);
  const messages = await loadThread(c.env.DB, c.get('creator').id, thread);
  return c.json({ thread, messages });
});

chatRoutes.delete('/:thread', async (c) => {
  const thread = c.req.param('thread');
  if (!THREAD_RE.test(thread)) return c.json({ error: 'Unknown conversation' }, 400);
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE creator_id = ? AND thread = ?')
    .bind(c.get('creator').id, thread)
    .run();
  return c.json({ success: true });
});
