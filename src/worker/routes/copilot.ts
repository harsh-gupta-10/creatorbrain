import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import { runProductResearcher } from '../agents/definitions/studioAndResearch';
import type { Product } from '../../shared/types';

export const copilotRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI?: import('../ai/types').WorkersAIBinding;
  };
}>();

copilotRoutes.post('/chat', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

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
      detectedProduct = await runProductResearcher(userMessage, creator.id, router, c.env.DB);
      if (detectedProduct) {
        await dbClient.saveProduct(detectedProduct);
      }
    } catch (e) {
      console.warn('Product research in copilot failed:', e);
    }
  }

  // Build System Prompt grounded in Creator DNA
  const systemPrompt = `You are CreatorBrain Copilot, the world's most capable AI pair-creator and strategist for YouTube and short-form creators.
You are collaborating with ${creator.name} (@${creator.handle}), who runs the channel "${creator.channel_title || creator.name}" (${creator.subscribers.toLocaleString()} subscribers, Niche: ${creator.niche || 'Tech & Hardware'}).

CREATOR DNA & SIGNATURE VOICE:
- Tone: ${dnaSummary?.voice?.tone || 'Candid, enthusiastic, engineering-grounded, zero fluff'}
- Pacing: ${dnaSummary?.voice?.pace || 'Conversational and high-velocity'}
- Language Mix: ${dnaSummary?.voice?.language_mix || 'Hinglish (75% English, 25% Hindi colloquial tech terms)'}
- Signature Catchphrases: ${dnaSummary?.voice?.catchphrases?.join(', ') || '"Let us pop the hood on this", "Is it worth your hard-earned rupees?", "Real talk", "No sponsored BS"'}
- Hook Formula: ${dnaSummary?.voice?.hook_formula || 'Bold provocation + physical component teardown in first 4s'}
- Target Audience: ${dnaSummary?.audience?.primary_demographic || '18-34 tech enthusiasts, engineering students, value-conscious buyers'}
- Retention Focus: Prevent viewer drop-offs between minutes 4 and 6 with deliberate pattern interrupts and forward loops.

CURRENT MODE: ${mode.toUpperCase()}
${detectedProduct ? `RESOLVED AMAZON PRODUCT:
- Title: ${detectedProduct.title}
- ASIN: ${detectedProduct.asin}
- Price: ${detectedProduct.price_str} (${detectedProduct.price_timestamp})
- Tag: ${creator.handle}-21` : ''}

INSTRUCTIONS:
1. Speak as a peer collaborator who deeply understands ${creator.name}'s exact editing style, audience, and revenue goals.
2. Structure your suggestions clearly with Markdown headers, bullet points, and high-CTR hooks.
3. If discussing products or reviews, automatically suggest 2-3 viral angles, the ideal retention structure, and affiliate link placement.
4. Keep advice crisp, actionable, and formatted for fast scanning.`;

  const messages = [
    ...(body.history || []).map((h) => ({
      role: h.role,
      content: h.content,
    })),
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];

  let replyText = '';
  try {
    replyText = await router.generateText(
      [{ role: 'system', content: systemPrompt }, ...messages],
      { preferred: 'claude', fast: false, creatorId: creator.id }
    );
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
      title: userMessage.replace(/(?:make|create|turn into|start) (?:a )?project (?:about|on|for)?/i, '').trim() || 'New Video Project',
      brief: userMessage,
    };
  }

  return c.json({
    reply: replyText,
    detectedProduct,
    proposedProject,
    suggestedPrompts,
  });
});
