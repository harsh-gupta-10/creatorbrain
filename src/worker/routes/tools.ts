import { Hono } from 'hono';
import { appendToThread } from '../lib/chats';
import { draftLanguageRule } from '../lib/language';
import { creatorDna } from '../lib/dna';
import type { AppEnv } from '../env';
import { AIRouter } from '../ai/router';
import { ToolGeneratorSchema } from '../../shared/types';

export const toolsRoutes = new Hono<AppEnv>();

toolsRoutes.post('/generate', async (c) => {
  const creator = c.get('creator');

  const body = await c.req.json();
  const parsed = ToolGeneratorSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, 400);
  }

  const { toolType, topic, targetProduct, platform } = parsed.data;
  const router = new AIRouter(c.env);

  const dna = creatorDna(creator);

  const systemPrompt = `You are the CreatorBrain DNA-Powered Tool Generator.
You generate content specifically aligned with this creator's DNA:
- Tone: ${dna.voice.tone}
- Language: ${dna.voice.language_mix}
- Catchphrases: ${dna.voice.catchphrases.join(', ')}
- Hook Formula: ${dna.voice.hook_formula}
- Thumbnail Palette: ${dna.visual.thumbnail_palette.join(', ')}
- Platform: ${platform}
- Target Product: ${targetProduct || 'N/A'}

${draftLanguageRule(creator)}`;

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

  await appendToThread(c.env.DB, creator.id, `tools:${toolType}`, [
    { role: 'user', content: topic, meta: { platform, targetProduct: targetProduct || null } },
    { role: 'assistant', content: generated },
  ]);

  return c.json({
    toolType,
    topic,
    platform,
    output: generated,
  });
});
