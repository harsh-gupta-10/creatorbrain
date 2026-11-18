import { z } from 'zod';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIToolDefinition<T = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  execute: (args: T, context?: Record<string, unknown>) => Promise<unknown>;
}

export interface AIGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fast?: boolean;
  creatorId?: string;
}

export interface AIProvider {
  name: string;
  generateText(messages: AIMessage[], options?: AIGenerateOptions): Promise<string>;
  generateStructured<T>(messages: AIMessage[], schema: z.ZodType<T>, options?: AIGenerateOptions): Promise<T>;
}

export interface WorkersAIBinding {
  run: (model: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}
