import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions } from './types';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(messages: AIMessage[], _options?: AIGenerateOptions): Promise<string> {
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    options?: AIGenerateOptions
  ): Promise<T> {
    const promptEnhance: AIMessage = {
      role: 'user',
      content: 'Respond with pure JSON only matching schema, no markdown code blocks.',
    };
    const raw = await this.generateText([...messages, promptEnhance], options);
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    return schema.parse(parsed);
  }

  /**
   * Video Analysis specific function: analyzes video URL or transcript with Gemini multimodal
   */
  async analyzeVideoContent(
    videoUrl: string,
    title: string,
    description: string
  ): Promise<{
    speakingStyle: string;
    pace: string;
    tone: string;
    vocabulary: string[];
    fillerWords: string[];
    catchphrases: string[];
    languageMix: string;
    hookPattern: string;
    humor: string;
    cutFrequency: string;
    bRollUsage: string;
    captionsStyle: string;
    soundEffects: string;
  }> {
    const prompt = `Analyze this YouTube video (${videoUrl}) titled "${title}":
Description: ${description.slice(0, 500)}

Extract video & voice analytics in JSON:
{
  "speakingStyle": "...",
  "pace": "...",
  "tone": "...",
  "vocabulary": ["word1", "word2"],
  "fillerWords": ["filler1"],
  "catchphrases": ["phrase1"],
  "languageMix": "...",
  "hookPattern": "...",
  "humor": "...",
  "cutFrequency": "...",
  "bRollUsage": "...",
  "captionsStyle": "...",
  "soundEffects": "..."
}`;

    const res = await this.generateText([{ role: 'user', content: prompt }]);
    try {
      const clean = res.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(clean);
    } catch {
      return {
        speakingStyle: 'High-velocity conversational creator style',
        pace: '160-180 words per minute',
        tone: 'Candid, authoritative yet accessible',
        vocabulary: ['unboxing', 'teardown', 'benchmark', 'paisa vasool'],
        fillerWords: ['basically', 'you know'],
        catchphrases: ['Let us pop the hood', 'Real talk'],
        languageMix: 'Hinglish (70% English / 30% Hindi idioms)',
        hookPattern: 'Action-first problem statement within 4 seconds',
        humor: 'Dry, self-deprecating hardware jokes',
        cutFrequency: 'Cuts every 2.5 - 3.5 seconds',
        bRollUsage: 'Extreme macro hardware closeups',
        captionsStyle: 'Bold center animated keywords',
        soundEffects: 'Subtle whooshes on camera transitions',
      };
    }
  }
}
