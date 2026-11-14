import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions, WorkersAIBinding } from './types';

export class WorkersAIProvider implements AIProvider {
  name = 'workers-ai';
  private aiBinding?: WorkersAIBinding;
  private defaultModel: string;

  constructor(aiBinding?: WorkersAIBinding, defaultModel = '@cf/meta/llama-3.3-70b-instruct-fp8-fast') {
    this.aiBinding = aiBinding;
    this.defaultModel = defaultModel;
  }

  async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    if (!this.aiBinding) {
      throw new Error('Workers AI binding (env.AI) is not configured.');
    }

    const model = options?.model || this.defaultModel;
    const response = await this.aiBinding.run(model, {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature ?? 0.7,
    });

    const out = response?.response;
    if (typeof out === 'string') return out;
    return out ? JSON.stringify(out) : '';
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    options?: AIGenerateOptions
  ): Promise<T> {
    const jsonPrompt: AIMessage = {
      role: 'user',
      content: 'Respond ONLY with valid JSON matching the schema. No markdown backticks or commentary.',
    };

    const raw = await this.generateText([...messages, jsonPrompt], options);
    // Models sometimes wrap JSON in prose or code fences: take the outermost object
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Workers AI returned no JSON object');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return schema.parse(parsed);
  }
}
