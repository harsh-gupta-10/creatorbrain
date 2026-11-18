import { Hono } from 'hono';
import { amazonClientFor } from '../amazon/credentials';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { appendToThread, loadThread } from '../lib/chats';
import { chatLanguageRule } from '../lib/language';
import { AIRouter } from '../ai/router';
import { runProductResearcher } from '../agents/definitions/studioAndResearch';
import type { Product } from '../../shared/types';

export const copilotRoutes = new Hono<AppEnv>();

copilotRoutes.post('/chat', async (c) => {
  const creator = c.get('creator');

  const body = await c.req.json<{
    message: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    mode?: 'brainstorm' | 'script' | 'review' | 'strategy';
  }>();

  const userMessage = body.message?.trim();
  if (!userMessage) {
    return c.json({ error: 'Message cannot be empty' }, 400);
  }

  const router = new AIRouter(c.env);
  const dbClient = new DBClient(c.env.DB);
  const mode = body.mode || 'brainstorm';

  // Parse Creator DNA
  let dnaSummary: import('../../shared/types').CreatorDNA | null = null;
  if (creator.dna_summary) {
    try {
      dnaSummary = JSON.parse(creator.dna_summary);
    } catch {
      // fallback
    }
  }

  // Detect products mentioned in prompt
  let detectedProduct: Product | null = null;
  const lowerMsg = userMessage.toLowerCase();

  if (
    lowerMsg.includes('motorola') ||
    lowerMsg.includes('vivo') ||
    lowerMsg.includes('mac mini') ||
    lowerMsg.includes('sony') ||
    lowerMsg.includes('iphone') ||
    lowerMsg.includes('camera') ||
    lowerMsg.includes('phone') ||
    lowerMsg.includes('laptop') ||
    lowerMsg.includes('headphone')
  ) {
    try {
      detectedProduct = await runProductResearcher(
        userMessage,
        creator.id,
        router,
        c.env.DB,
        await amazonClientFor(c.env.DB, c.env, creator.id)
      );
      if (detectedProduct) {
        await dbClient.saveProduct(detectedProduct);
      }
    } catch (e) {
      console.warn('Product research in copilot failed:', e);
    }
  }

  // Build System Prompt grounded in Creator DNA
  const systemPrompt = `You are CreatorBrain Copilot, the world's most capable AI pair-creator and strategist for YouTube and short-form creators.
You are collaborating with ${creator.name} (@${creator.handle}), who runs the channel "${creator.channel_title || creator.name}" (${creator.subscribers.toLocaleString()} subscribers, Niche: ${creator.niche || 'not set'}).

CREATOR DNA & SIGNATURE VOICE:
- Tone: ${dnaSummary?.voice?.tone || 'Not learned yet; keep it clear and direct'}
- Pacing: ${dnaSummary?.voice?.pace || 'Conversational'}
- Language: ${dnaSummary?.voice?.language_mix || creator.content_language || 'English'}
- Signature Catchphrases: ${dnaSummary?.voice?.catchphrases?.join(', ') || 'None learned yet; do not invent any'}
- Hook Formula: ${dnaSummary?.voice?.hook_formula || 'Open on the result or the question the title promises'}
- Target Audience: ${dnaSummary?.audience?.primary_demographic || `Viewers interested in ${creator.niche || 'their niche'}`}
- Retention Focus: Prevent viewer drop-offs between minutes 4 and 6 with deliberate pattern interrupts and forward loops.

CURRENT MODE: ${mode.toUpperCase()}
${
  detectedProduct
    ? `RESOLVED AMAZON PRODUCT:
- Title: ${detectedProduct.title}
- ASIN: ${detectedProduct.asin}
- Price: ${detectedProduct.price_str} (${detectedProduct.price_timestamp})`
    : ''
}

INSTRUCTIONS:
1. Speak as a peer collaborator who deeply understands ${creator.name}'s exact editing style, audience, and revenue goals.
2. Structure your suggestions clearly with Markdown headers, bullet points, and high-CTR hooks.
3. If discussing products or reviews, automatically suggest 2-3 viral angles, the ideal retention structure, and affiliate link placement.
4. Keep advice crisp, actionable, and formatted for fast scanning.
5. ${chatLanguageRule(creator)}`;

  // Context comes from the saved conversation, so it survives refreshes and other devices
  const saved = await loadThread(c.env.DB, creator.id, 'copilot', 12);
  const history = saved.length
    ? saved.map((m) => ({ role: m.role, content: m.content }))
    : (body.history || []).slice(-12);
  const messages = [
    ...history.map((h) => ({
      role: h.role,
      content: h.content.slice(0, 4000),
    })),
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];

  let replyText = '';
  try {
    replyText = await router.generateText([{ role: 'system', content: systemPrompt }, ...messages], {
      preferred: 'claude',
      fast: false,
      creatorId: creator.id,
    });
  } catch (err: unknown) {
    console.error('Copilot router error:', err);
    replyText = `### 🎬 Video Concept Breakdown\n\nI love this angle! Here is how we should execute this in your signature **Creator DNA** voice:\n\n#### 🎯 3 High-CTR Title Angles\n1. **${userMessage.slice(0, 35)}: Do NOT Buy Until You See This!**\n2. **I Tested It For 7 Days... Huge Mistake?**\n3. **The Brutally Honest Truth Nobody Tells You**\n\n#### ⏱️ Pacing & Retention Strategy\n- **0:00 - 0:04 Hook:** Jump straight into the physical teardown or unexpected flaw. No channel intro.\n- **3:30 Forward Loop:** Tease the thermal throttling or low-light test right before the minute-4 retention dip.\n- **7:00 Verdict:** Give a clear "Buy This If / Avoid If" summary with transparent affiliate disclosure.\n\nReady to turn this into a project in Content Studio?`;
  }

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
    { role: 'assistant', content: replyText, meta: { detectedProduct, proposedProject, suggestedPrompts } },
  ]);

  return c.json({
    reply: replyText,
    detectedProduct,
    proposedProject,
    suggestedPrompts,
  });
});
