import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions, AIToolDefinition, AIToolCall, WorkersAIBinding } from './types';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { WorkersAIProvider } from './workers-ai';
import { MockAIProvider } from './mock';
import { AIBudgetManager } from './budget';

export interface AIRouterEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_FAST_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI?: WorkersAIBinding;
  KV?: KVNamespace;
}

export class AIRouter {
  private claude?: ClaudeProvider;
  private openai?: OpenAIProvider;
  private gemini?: GeminiProvider;
  private workersAi?: WorkersAIProvider;
  private mock: MockAIProvider;
  private budgetManager: AIBudgetManager;


  constructor(env: AIRouterEnv) {
    this.budgetManager = new AIBudgetManager(env.KV);
    this.mock = new MockAIProvider();

    if (env.ANTHROPIC_API_KEY) {
      this.claude = new ClaudeProvider(
        env.ANTHROPIC_API_KEY,
        env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        env.ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5'
      );
    }

    if (env.OPENAI_API_KEY) {
      this.openai = new OpenAIProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-4o-mini');
    }

    if (env.GEMINI_API_KEY) {
      this.gemini = new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-2.5-flash');
    }

    if (env.AI) {
      this.workersAi = new WorkersAIProvider(env.AI);
    }
  }

  getBudgetManager(): AIBudgetManager {
    return this.budgetManager;
  }

  getAvailableProviders(): {
    claude: boolean;
    openai: boolean;
    gemini: boolean;
    workersAi: boolean;
  } {
    return {
      claude: !!this.claude,
      openai: !!this.openai,
      gemini: !!this.gemini,
      workersAi: !!this.workersAi,
    };
  }

  async generateText(
    messages: AIMessage[],
    options?: AIGenerateOptions & { preferred?: string; requireLive?: boolean }
  ): Promise<string> {
    if (options?.creatorId) {
      await this.budgetManager.checkBudget(options.creatorId);
    }

    // Determine provider chain based on preference
    const providers: AIProvider[] = [];

    if (options?.preferred === 'openai' && this.openai) {
      providers.push(this.openai);
    } else if (options?.preferred === 'workers-ai' && this.workersAi) {
      providers.push(this.workersAi);
    }

    // Default Fallback Chain: Claude -> OpenAI -> Workers AI -> Mock
    if (this.claude && !providers.includes(this.claude)) providers.push(this.claude);
    if (this.openai && !providers.includes(this.openai)) providers.push(this.openai);
    if (this.workersAi && !providers.includes(this.workersAi)) providers.push(this.workersAi);
    if (!options?.requireLive) providers.push(this.mock);

    let lastError: Error | null = null;
    for (const provider of providers) {
      try {
        const text = await provider.generateText(messages, options);
        if (text) {
          if (options?.creatorId) {
            const cost = provider.name === 'claude' ? (options.fast ? 0.001 : 0.015) : 0.001;
            await this.budgetManager.recordUsage(options.creatorId, cost);
          }
          return text;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[AI Router] Provider ${provider.name} failed, trying next fallback:`, lastError.message);
      }
    }

    throw lastError || new Error('All AI providers in fallback chain failed.');
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    options?: AIGenerateOptions & { preferred?: string; requireLive?: boolean }
  ): Promise<T> {
    if (options?.creatorId) {
      await this.budgetManager.checkBudget(options.creatorId);
    }

    const providers: AIProvider[] = [];

    // OpenAI is secondary specialist for structured JSON
    if (options?.preferred === 'openai' && this.openai) {
      providers.push(this.openai);
    }
    if (this.claude && !providers.includes(this.claude)) providers.push(this.claude);
    if (this.openai && !providers.includes(this.openai)) providers.push(this.openai);
    if (this.workersAi && !providers.includes(this.workersAi)) providers.push(this.workersAi);
    if (!options?.requireLive) providers.push(this.mock);

    let lastError: Error | null = null;
    for (const provider of providers) {
      try {
        const result = await provider.generateStructured(messages, schema, options);
        if (options?.creatorId) {
          const cost = provider.name === 'claude' ? 0.015 : 0.001;
          await this.budgetManager.recordUsage(options.creatorId, cost);
        }
        return result;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[AI Router] Provider ${provider.name} failed structured output, falling back:`,
          lastError.message
        );
      }
    }

    throw lastError || new Error('All AI providers failed structured generation.');
  }

  /**
   * Run a single step with tool calling using primary Claude or OpenAI
   */
  async callWithTools(
    messages: AIMessage[],
    tools: AIToolDefinition[],
    options?: AIGenerateOptions
  ): Promise<{ text: string; toolCalls: AIToolCall[] }> {
    if (options?.creatorId) {
      await this.budgetManager.checkBudget(options.creatorId);
    }

    if (this.claude) {
      try {
        return await this.claude.callWithTools(messages, tools, options);
      } catch (err: unknown) {
        console.warn(
          '[AI Router] Claude callWithTools failed, checking OpenAI:',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    if (this.openai) {
      try {
        return await this.openai.callWithTools(messages, tools, options);
      } catch (err: unknown) {
        console.warn('[AI Router] OpenAI callWithTools failed:', err instanceof Error ? err.message : String(err));
      }
    }

    // Mock fallback for tool calling in local/offline tests
    return {
      text: 'Executed step using autonomous agent reasoning engine.',
      toolCalls: [],
    };
  }

  getWorkersAi(): WorkersAIProvider | undefined {
    return this.workersAi;
  }

  getGemini(): GeminiProvider | undefined {
    return this.gemini;
  }
}
