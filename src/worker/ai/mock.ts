import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions } from './types';

export class MockAIProvider implements AIProvider {
  name = 'mock-ai';

  async generateText(messages: AIMessage[], _options?: AIGenerateOptions): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';

    if (lastMsg.includes('title')) {
      return `1. Don't Buy Until You See This! (Honest Review)
2. I Tested It For 7 Days... Huge Mistake?
3. The Truth Nobody Is Telling You
4. Real Teardown & Benchmark Truth!
5. Best In Its Class? Here's The Verdict`;
    }

    if (lastMsg.includes('hook') || lastMsg.includes('intro')) {
      return `Most reviewers will tell you this is perfect. They're wrong. In the next 8 minutes, let's pop the hood, look at the thermals, and see if it's worth your hard-earned rupees.`;
    }

    if (lastMsg.includes('compliance')) {
      return `COMPLIANCE AUDIT PASSED: Conspicuous Amazon Associates disclosure identified in description top-3 lines. Pricing snapshot accurately timestamped. No unsubstantiated performance claims detected.`;
    }

    if (lastMsg.includes('quiz') || lastMsg.includes('assess')) {
      return `Generated assessment questions targeting retention pacing, disclosure transparency, and thumbnail curiosity gaps.`;
    }

    return `Here is the comprehensive content synthesized according to Creator DNA voice and high-velocity pacing. All key product specs and transparent Amazon short links have been populated.`;
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    _options?: AIGenerateOptions
  ): Promise<T> {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';

    // If schema is asking for CreatorDNA
    if (lastMsg.includes('creator dna') || lastMsg.includes('synthesizer') || lastMsg.includes('voice')) {
      const mockDNA = {
        voice: {
          pace: 'Conversational & high-velocity',
          tone: 'Candid, enthusiastic, engineering-grounded',
          catchphrases: ['Let us pop the hood on this', 'Is it worth your hard-earned rupees?', 'Real talk'],
          language_mix: 'Hinglish (75% English, 25% Hindi colloquial tech terms)',
          filler_ratio: 'Low (tightly cut)',
          hook_formula: 'Bold provocation + physical component teardown in first 4s',
        },
        visual: {
          thumbnail_palette: ['#FF0055', '#00F0FF', '#111827', '#F59E0B'],
          composition: 'Subject on left with high key backlight, expressive creator reaction face on right, 3-word bold title card',
          text_overlay_words: 3,
          contrast: 'High dynamic range with complementary cyan-amber lighting',
        },
        packaging: {
          title_avg_length: 48,
          title_patterns: [
            '[Product]: Do NOT Buy Until You See This!',
            'I Tested [Product] For 7 Days... Huge Mistake?',
            'The Truth About [Product] Nobody Is Telling You',
          ],
          description_hook_length: 140,
          disclosure_position: 'First 3 lines of description & pinned comment',
        },
        audience: {
          primary_demographic: '18-34 engineering students, coders, tech hobbyists across India & SE Asia',
          buying_intent: 'High VFM (Value For Money) focus between INR 15,000 to INR 35,000',
        },
      };
      return schema.parse(mockDNA);
    }

    // Default mock object
    const sample = {
      status: 'success',
      passed: true,
      analysis: 'Synthesized with mock intelligence provider',
      score: 5,
    };
    return schema.parse(sample);
  }
}
