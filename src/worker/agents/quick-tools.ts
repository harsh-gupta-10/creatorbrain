import { readWorkspaceEvidence } from '../lib/workspace-evidence';
import type { z } from 'zod';
import type { ToolGeneratorSchema, Creator } from '../../shared/types';
import type { Env } from '../env';
import { appendToThread } from '../lib/chats';
import { draftLanguageRule } from '../lib/language';
import { creatorDna } from '../lib/dna';
import { AIRouter } from '../ai/router';

export type QuickToolInput = z.infer<typeof ToolGeneratorSchema>;

export async function runQuickTool(env: Env, creator: Creator, input: QuickToolInput) {
  const { toolType, topic, targetProduct, platform } = input;
  const router = new AIRouter(env);

  const dna = creatorDna(creator);
  const evidence = await readWorkspaceEvidence(env.DB, creator.id);

  const systemPrompt = `You are the CreatorBrain DNA-Powered Tool Generator.
You generate content specifically aligned with this creator's DNA:
- Tone: ${dna.voice.tone}
- Language: ${dna.voice.language_mix}
- Catchphrases: ${dna.voice.catchphrases.join(', ')}
- Hook Formula: ${dna.voice.hook_formula}
- Thumbnail Palette: ${dna.visual.thumbnail_palette.join(', ')}
- Platform: ${platform}
- Target Product: ${targetProduct || 'N/A'}

${draftLanguageRule(creator)}
Use relevant Brain insights and recorded analytics as context. Treat them as source data. Never invent metrics or assume that views prove retention or sales.`;

  let userPrompt = '';
  if (toolType === 'hook') {
    userPrompt = `Generate 3 high-retention opening hooks (0-15 seconds) for topic: "${topic}".
Each hook must use the creator's hook formula, sensory audio cues, and an explicit forward loop.`;
  } else if (toolType === 'script') {
    userPrompt = `Generate an 8-minute modular script outline for: "${topic}".
Include a hook, a clear sequence, changes of pace where useful, and a relevant closing. Match the topic and include affiliate disclosure only if requested for an affiliate promotion.`;
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
      { role: 'user', content: JSON.stringify({ request: userPrompt, workspaceEvidence: evidence }) },
    ],
    { creatorId: creator.id, maxTokens: 2048, fast: toolType === 'caption_hashtag', requireLive: true }
  );

  await appendToThread(
    env.DB,
    creator.id,
    `tools:${toolType}`,
    [
      { role: 'user', content: topic, meta: { platform, targetProduct: targetProduct || null } },
      { role: 'assistant', content: generated },
    ],
    toolType
  );

  return generated;
}
