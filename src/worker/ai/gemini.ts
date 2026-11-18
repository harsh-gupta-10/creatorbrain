import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions } from './types';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    return this.call({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens || 2048 },
    });
  }

  async generateStructured<T>(messages: AIMessage[], schema: z.ZodType<T>, options?: AIGenerateOptions): Promise<T> {
    const promptEnhance: AIMessage = {
      role: 'user',
      content: 'Respond with pure JSON only matching schema, no markdown code blocks.',
    };
    const raw = await this.generateText([...messages, promptEnhance], options);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Gemini returned no JSON object');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return schema.parse(parsed);
  }

  /**
   * Watches a public YouTube video (Gemini accepts YouTube URLs as file input) and
   * optionally a thumbnail image, returning the model's JSON text.
   */
  async analyzeYouTubeVideo(
    videoUrl: string,
    prompt: string,
    thumbnail?: { mimeType: string; base64: string }
  ): Promise<string> {
    interface GeminiPart {
      file_data?: { file_uri: string };
      inline_data?: { mime_type: string; data: string };
      text?: string;
    }
    const parts: GeminiPart[] = [{ file_data: { file_uri: videoUrl } }];
    if (thumbnail) parts.push({ inline_data: { mime_type: thumbnail.mimeType, data: thumbnail.base64 } });
    parts.push({ text: prompt });
    return this.call({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8192 },
    });
  }

  /** Describes a single image, returning JSON text */
  async analyzeImage(prompt: string, image: { mimeType: string; base64: string }): Promise<string> {
    return this.call({
      contents: [
        { role: 'user', parts: [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }, { text: prompt }] },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });
  }

  private async call(body: unknown): Promise<string> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
    interface GeminiResponse {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    }
    const data = (await res.json()) as GeminiResponse;
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  }
}
