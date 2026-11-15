import type { Creator } from '../shared/types';
import type { WorkersAIBinding } from './ai/types';

/** Worker bindings, vars and secrets (see wrangler.jsonc and .dev.vars.example) */
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS?: Fetcher;
  AI?: WorkersAIBinding;
  AUTH_LIMITER?: { limit(opts: { key: string }): Promise<{ success: boolean }> };

  ENVIRONMENT?: string;
  ENCRYPTION_KEY?: string;

  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_FAST_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  YOUTUBE_API_KEY?: string;
}

/** Set by the /api auth middleware for every signed-in request */
export interface AuthVariables {
  creator: Creator;
  isSample: boolean;
}

export type AppEnv = { Bindings: Env; Variables: AuthVariables };
