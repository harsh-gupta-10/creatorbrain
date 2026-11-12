import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { AIRouter } from '../ai/router';
import { ToolGeneratorSchema, CreatorDNASchema } from '../../shared/types';

export const toolsRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI?: any;
  };
}>();

toolsRoutes.post('/generate', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = ToolGeneratorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, 400);
  }

  const { toolType, topic, targetProduct, platform } = parsed.data;
  const router = new AIRouter(c.env);

  let dna = {
    voice: {
      pace: 'Fast & conversational',
      tone: 'Candid, engineering-grounded',
      catchphrases: ['Let us pop the hood', 'Real talk', 'Is it paisa vasool?'],
      language_mix: 'Hinglish (70% English / 30% Hindi idioms)',
      hook_formula: 'Action-first teardown in first 4s',
    },
    visual: {
      thumbnail_palette: ['#FF0055', '#00F0FF', '#111827', '#F59E0B'],
      composition: 'Hero on left, expressive reaction on right',
      text_overlay_words: 3,
    },
    packaging: {
      title_avg_length: 48,
      title_patterns: ['[Product]: Don\'t Buy Until You See This!'],
      disclosure_position: 'Top 3 lines',
    },
    audience: {
      primary_demographic: '18-34 tech enthusiasts',
      buying_intent: 'High VFM focus',
    },
  };

  if (creator.dna_summary) {
    try {
      dna = CreatorDNASchema.parse(JSON.parse(creator.dna_summary));
    } catch {
      // fallback
    }
  }

  const systemPrompt = `You are the CreatorBrain DNA-Powered Tool Generator.
You generate content specifically aligned with this creator's DNA:
- Tone: ${dna.voice.tone}
- Language: ${dna.voice.language_mix}
- Catchphrases: ${dna.voice.catchphrases.join(', ')}
- Hook Formula: ${dna.voice.hook_formula}
- Thumbnail Palette: ${dna.visual.thumbnail_palette.join(', ')}
- Platform: ${platform}
- Target Product: ${targetProduct || 'N/A'}`;

  let userPrompt = '';
  if (toolType === 'hook') {
    userPrompt = `Generate 3 high-retention opening hooks (0-15 seconds) for topic: "${topic}".
Each hook must use the creator's hook formula, sensory audio cues, and an explicit forward loop.`;
  } else if (toolType === 'script') {
    userPrompt = `Generate an 8-minute modular script outline for: "${topic}".
Include Hook (0-30s), Pattern Interrupt at minute 4, Benchmark Teardown, and Call to Action with Amazon disclosure.`;
  } else if (toolType === 'thumbnail') {
    userPrompt = `Generate 3 bold thumbnail concepts for: "${topic}".
Each must feature at most 3 words of bold text overlay, complementary color separation using palette (${dna.visual.thumbnail_palette.join(
      ', '
    )}), creator facial expression, and an AI image generation prompt.`;
  } else if (toolType === 'caption_hashtag') {
    userPrompt = `Generate 2 platform-optimized captions with targeted hashtags for ${platform} on topic: "${topic}". Include call-to-action for link in bio.`;
  }

  const generated = await router.generateText(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { creatorId: creator.id, maxTokens: 2048, fast: toolType === 'caption_hashtag' }
  );

  return c.json({
    toolType,
    topic,
    platform,
    output: generated,
  });
});
