import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions, WorkersAIBinding } from './types';

export class WorkersAIProvider implements AIProvider {
  name = 'workers-ai';
  private aiBinding?: WorkersAIBinding;
  private defaultModel: string;

  constructor(aiBinding?: WorkersAIBinding, defaultModel = '@cf/meta/llama-3.1-8b-instruct') {
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

    const outputText = typeof response?.response === 'string' ? response.response : '';
    return outputText;
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
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    return schema.parse(parsed);
  }
}
