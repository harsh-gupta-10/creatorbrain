export interface ChatSuggestion {
  id: string;
  label: string;
  prompt: string;
  reason: string;
}

export const WORKSPACE_TOOLS = {
  hook: 'Hook ideas',
  script: 'Script outline',
  thumbnail: 'Thumbnail ideas',
  caption_hashtag: 'Captions',
  affiliate_link: 'Amazon affiliate link',
  short_link: 'Short links',
  link_stats: 'Short link analytics',
  saved_agent: 'Saved agents',
} as const;

export type WorkspaceTool = keyof typeof WORKSPACE_TOOLS;

export interface ToolMemory {
  tool: WorkspaceTool;
  lastUsedAt: string;
}
