import { runChatTool } from '../agents/chat-tools';
import { requestedAgent } from '../agents/saved';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { appendToThread, loadThread } from '../lib/chats';
import { AIRouter } from '../ai/router';
import { affiliateLookup, compose, conversationContext, planChat } from '../agents/workspace';

export const copilotRoutes = new Hono<AppEnv>();

copilotRoutes.post('/chat', async (c) => {
  const creator = c.get('creator');

  const parsed = z
    .object({
      message: z.string().trim().min(1).max(8000),
      mode: z.enum(['brainstorm', 'script', 'review', 'strategy']).default('brainstorm'),
      history: z
        .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(20000) }))
        .max(200)
        .optional(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter a valid message.' }, 400);
  const { message: userMessage, mode } = parsed.data;
  const lowerMsg = userMessage.toLowerCase();
  const router = new AIRouter(c.env);
  const saved = await loadThread(c.env.DB, creator.id, 'copilot', 12);
  const context = saved.length
    ? conversationContext(saved)
    : JSON.stringify(parsed.data.history?.slice(-6).map((m) => m.content.slice(0, 1000)) || []);
  const tool = await runChatTool({ env: c.env, creator, message: userMessage, history: saved, origin: new URL(c.req.url).origin });
  if (tool) {
    await appendToThread(c.env.DB, creator.id, 'copilot', [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: tool.reply, meta: tool.meta },
    ]);
    return c.json({ reply: tool.reply, detectedProduct: null, proposedProject: null, suggestedPrompts: [] });
  }
  const report = await requestedAgent(c.env, creator, userMessage, context);
  if (report) {
    await appendToThread(c.env.DB, creator.id, 'copilot', [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: report },
    ]);
    return c.json({ reply: report, detectedProduct: null, proposedProject: null, suggestedPrompts: [] });
  }
  const plan = await planChat(router, creator.id, userMessage, context);
  const lookup = plan.action === 'link' || plan.product ? await affiliateLookup(c.env, creator.id, plan.product) : null;
  const replyText =
    plan.action === 'link'
      ? lookup!.reply
      : await compose(
          c.env,
          creator,
          router,
          userMessage,
          context,
          plan.action === 'bundle' ? 'chat' : plan.action,
          [mode, lookup?.reply].join('\n')
        );
  const detectedProduct = lookup?.matches[0] || null;

  // Generate actionable suggestions
  const suggestedPrompts = [
    'Turn this idea into a Content Studio project',
    'Write 5 title options in my voice',
    'Draft a 45-second YouTube Short script',
    'Find best Amazon affiliate deals for this',
  ];

  // If user asked to create a project, extract title & brief
  let proposedProject: { title: string; brief: string } | null = null;
  if (
    lowerMsg.includes('make a project') ||
    lowerMsg.includes('create a project') ||
    lowerMsg.includes('into a content studio project') ||
    lowerMsg.includes('turn into project') ||
    lowerMsg.includes('start project')
  ) {
    proposedProject = {
      title:
        userMessage.replace(/(?:make|create|turn into|start) (?:a )?project (?:about|on|for)?/i, '').trim() ||
        'New Video Project',
      brief: userMessage,
    };
  }

  await appendToThread(c.env.DB, creator.id, 'copilot', [
    { role: 'user', content: userMessage, meta: { mode } },
    { role: 'assistant', content: replyText, meta: { detectedProduct, proposedProject, suggestedPrompts, affiliateLinks: lookup?.affiliateLinks } },
  ]);

  return c.json({
    reply: replyText,
    detectedProduct,
    proposedProject,
    suggestedPrompts,
  });
});
