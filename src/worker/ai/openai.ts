import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions, AIToolDefinition, AIToolCall } from './types';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  private formatMessages(messages: AIMessage[]): any[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.tool_call_id,
          content: m.content,
        };
      }
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });
  }

  async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const formatted = this.formatMessages(messages);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: formatted,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    options?: AIGenerateOptions
  ): Promise<T> {
    const model = options?.model || this.defaultModel;
    const formatted = this.formatMessages([
      ...messages,
      {
        role: 'system',
        content: 'You must respond with valid JSON matching the requested schema strictly.',
      },
    ]);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: formatted,
        response_format: { type: 'json_object' },
        temperature: options?.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const raw = data.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (e: any) {
      throw new Error(`Failed to validate structured JSON from OpenAI: ${e.message}. Raw: ${raw}`);
    }
  }

  async callWithTools(
    messages: AIMessage[],
    tools: AIToolDefinition[],
    options?: AIGenerateOptions
  ): Promise<{ text: string; toolCalls: AIToolCall[] }> {
    const model = options?.model || this.defaultModel;
    const formatted = this.formatMessages(messages);

    const openaiTools = tools.map((t) => {
      const shape = t.parameters._def?.shape ? t.parameters._def.shape() : {};
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, zodType] of Object.entries(shape) as [string, any][]) {
        properties[key] = {
          type: 'string',
          description: zodType.description || key,
        };
        if (!zodType.isOptional || !zodType.isOptional()) {
          required.push(key);
        }
      }

      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      };
    });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: formatted,
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0]?.message;
    const text = choice?.content || '';
    const toolCalls: AIToolCall[] = [];

    if (choice?.tool_calls) {
      for (const tc of choice.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        });
      }
    }

    return { text, toolCalls };
  }
}
