import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions, AIToolDefinition, AIToolCall } from './types';

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  private apiKey: string;
  private defaultModel: string;
  private fastModel: string;

  constructor(apiKey: string, defaultModel = 'claude-sonnet-5-5', fastModel = 'claude-haiku-5-5') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.fastModel = fastModel;
  }

  private formatMessages(messages: AIMessage[]): {
    system?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }>;
  } {
    let system: string | undefined = undefined;
    const formatted: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = system ? `${system}\n\n${msg.content}` : msg.content;
      } else if (msg.role === 'tool') {
        formatted.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id,
              content: msg.content,
            },
          ],
        });
      } else if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const contentBlocks: Array<Record<string, unknown>> = [];
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        formatted.push({
          role: 'assistant',
          content: contentBlocks,
        });
      } else {
        formatted.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    return { system, messages: formatted };
  }

  async generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const { system, messages: formattedMessages } = this.formatMessages(messages);
    const model = options?.model || (options?.fast ? this.fastModel : this.defaultModel);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
        system,
        messages: formattedMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    interface ClaudeBlock {
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }
    interface ClaudeResponse {
      content?: ClaudeBlock[];
    }
    const data = (await res.json()) as ClaudeResponse;
    const textBlock = data.content?.find((b) => b.type === 'text');
    return textBlock?.text || '';
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    options?: AIGenerateOptions
  ): Promise<T> {
    const promptEnhancement: AIMessage = {
      role: 'user',
      content:
        'IMPORTANT: Respond with pure, valid JSON only. Do not wrap in markdown quotes or code blocks. Zero commentary before or after the JSON.',
    };

    const raw = await this.generateText([...messages, promptEnhancement], {
      ...options,
      temperature: 0.1,
    });

    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(clean);
      return schema.parse(parsed);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to validate structured JSON from Claude: ${message}`);
    }
  }

  async callWithTools(
    messages: AIMessage[],
    tools: AIToolDefinition[],
    options?: AIGenerateOptions
  ): Promise<{ text: string; toolCalls: AIToolCall[] }> {
    const { system, messages: formattedMessages } = this.formatMessages(messages);
    const model = options?.model || this.defaultModel;

    // Convert Zod schemas to Anthropic tool input_schema
    const anthropicTools = tools.map((t) => {
      // Basic JSON schema conversion from Zod object
      const def = t.parameters._def as { shape?: unknown } | undefined;
      const shape = (typeof def?.shape === 'function' ? (def.shape as () => Record<string, unknown>)() : (t.parameters.shape as Record<string, unknown>)) || {};
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
        name: t.name,
        description: t.description,
        input_schema: {
          type: 'object',
          properties,
          required,
        },
      };
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.5,
        system,
        messages: formattedMessages,
        tools: anthropicTools,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      content?: Array<{
        type: string;
        text?: string;
        id: string;
        name: string;
        input?: Record<string, unknown>;
      }>;
    };
    let text = '';
    const toolCalls: AIToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    return { text, toolCalls };
  }
}
