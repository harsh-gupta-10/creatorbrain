import { z } from 'zod';
import type { AIMessage, AIProvider, AIGenerateOptions, AIToolDefinition, AIToolCall } from './types';
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
  AI?: any; // Cloudflare Workers AI binding
  KV?: KVNamespace;
}

export class AIRouter {
  private claude?: ClaudeProvider;
  private openai?: OpenAIProvider;
  private gemini?: GeminiProvider;
  private workersAi?: WorkersAIProvider;
  private mock: MockAIProvider;
  private budgetManager: AIBudgetManager;
  private kv?: KVNamespace;

  constructor(env: AIRouterEnv) {
    this.kv = env.KV;
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
      this.gemini = new GeminiProvider(env.GEMINI_API_KEY, 'gemini-1.5-flash');
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

  private async getCachedResult(key: string): Promise<string | null> {
    if (!this.kv) return null;
    return await this.kv.get(`ai_cache:${key}`);
  }

  private async setCachedResult(key: string, val: string): Promise<void> {
    if (!this.kv) return;
    // Cache for 24 hours
    await this.kv.put(`ai_cache:${key}`, val, { expirationTtl: 86400 });
  }

  private hashPrompt(messages: AIMessage[]): string {
    const text = messages.map((m) => `${m.role}:${m.content}`).join('|');
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  async generateText(
    messages: AIMessage[],
    options?: AIGenerateOptions & { cacheable?: boolean; preferred?: string }
  ): Promise<string> {
    if (options?.creatorId) {
      await this.budgetManager.checkBudget(options.creatorId);
    }

    const cacheKey = options?.cacheable ? this.hashPrompt(messages) : null;
    if (cacheKey) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
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
    providers.push(this.mock);

    let lastError: Error | null = null;
    for (const provider of providers) {
      try {
        const text = await provider.generateText(messages, options);
        if (text) {
          if (options?.creatorId) {
            const cost = provider.name === 'claude' ? (options.fast ? 0.001 : 0.015) : 0.001;
            await this.budgetManager.recordUsage(options.creatorId, cost);
          }
          if (cacheKey) {
            await this.setCachedResult(cacheKey, text);
          }
          return text;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Router] Provider ${provider.name} failed, trying next fallback:`, err.message);
      }
    }

    throw lastError || new Error('All AI providers in fallback chain failed.');
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schema: z.ZodType<T>,
    options?: AIGenerateOptions & { preferred?: string }
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
    providers.push(this.mock);

    let lastError: Error | null = null;
    for (const provider of providers) {
      try {
        const result = await provider.generateStructured(messages, schema, options);
        if (options?.creatorId) {
          const cost = provider.name === 'claude' ? 0.015 : 0.001;
          await this.budgetManager.recordUsage(options.creatorId, cost);
        }
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Router] Provider ${provider.name} failed structured output, falling back:`, err.message);
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
      } catch (err: any) {
        console.warn('[AI Router] Claude callWithTools failed, checking OpenAI:', err.message);
      }
    }

    if (this.openai) {
      try {
        return await this.openai.callWithTools(messages, tools, options);
      } catch (err: any) {
        console.warn('[AI Router] OpenAI callWithTools failed:', err.message);
      }
    }

    // Mock fallback for tool calling in local/offline tests
    return {
      text: 'Executed step using autonomous agent reasoning engine.',
      toolCalls: [],
    };
  }

  getGemini(): GeminiProvider | undefined {
    return this.gemini;
  }
}
