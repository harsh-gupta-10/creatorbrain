import { z } from 'zod';

// ==========================================
// CREATOR & DNA SCHEMAS
// ==========================================

export const CreatorDNASchema = z.object({
  voice: z.object({
    pace: z.string(),
    tone: z.string(),
    catchphrases: z.array(z.string()),
    language_mix: z.string(),
    filler_ratio: z.string().optional(),
    hook_formula: z.string(),
  }),
  visual: z.object({
    thumbnail_palette: z.array(z.string()),
    composition: z.string(),
    text_overlay_words: z.number().default(3),
    contrast: z.string().optional(),
  }),
  packaging: z.object({
    title_avg_length: z.number().default(48),
    title_patterns: z.array(z.string()),
    description_hook_length: z.number().optional(),
    disclosure_position: z.string(),
  }),
  audience: z.object({
    primary_demographic: z.string(),
    buying_intent: z.string(),
  }),
});

export type CreatorDNA = z.infer<typeof CreatorDNASchema>;

export interface Creator {
  id: string;
  email?: string;
  name: string;
  handle: string;
  channel_title?: string;
  channel_url?: string;
  platform: 'youtube' | 'instagram' | 'both';
  subscribers: number;
  avatar_url?: string;
  bio?: string;
  niche: string;
  dna_summary?: string;
  onboarding_status?: 'profile' | 'study' | 'ready';
  youtube_input?: string | null;
  youtube_channel_id?: string | null;
  instagram_handle?: string | null;
  content_language?: string | null;
  upload_cadence?: string | null;
  goals_json?: string | null;
  monetization_json?: string | null;
  last_studied_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingJob {
  id: string;
  creator_id?: string;
  platform: 'youtube' | 'instagram';
  url_or_handle: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_step: string;
  progress_percent: number;
  result_json?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// GRAPH NODES & EDGES
// ==========================================

export type NodeType = 'Style' | 'Strength' | 'Gap' | 'Audience' | 'Concept' | 'Topic';
export type EdgeRelation = 'STRONG_AT' | 'NEEDS_WORK' | 'LEARNED_FROM' | 'RELATES_TO';

export interface GraphNode {
  id: string;
  creator_id: string;
  type: NodeType;
  label: string;
  description?: string;
  confidence: number;
  evidence_video_ids?: string; // JSON string array
  meta?: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface GraphEdge {
  id: string;
  creator_id: string;
  source_id: string;
  target_id: string;
  relation: EdgeRelation;
  weight: number;
  created_at: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Learning {
  id: string;
  creator_id: string;
  title: string;
  insight: string;
  source_agent: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  creator_id: string;
  gap_node_id?: string;
  order_index: number;
  title: string;
  category: string;
  duration_min: number;
  content_markdown: string;
  completed: number;
  completed_at?: string;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  creator_id: string;
  gap_node_id?: string;
  title: string;
  questions_json: string; // serialized QuizQuestion[]
  score?: number;
  status: 'pending' | 'completed';
  completed_at?: string;
  created_at: string;
}

// ==========================================
// AGENT TRACES & ANALYSIS JOBS
// ==========================================

export interface AgentTrace {
  id: string;
  creator_id: string;
  agent_name: string;
  task_description: string;
  step_number: number;
  total_steps: number;
  tool_called?: string;
  tool_input?: string;
  tool_result?: string;
  output_summary: string;
  status: 'success' | 'running' | 'failed';
  created_at: string;
}

export interface AnalysisJob {
  id: string;
  creator_id: string;
  channel_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  current_step: string;
  progress_percent: number;
  error_message?: string;
  result_json?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// PROJECTS & ASSETS
// ==========================================

export type ProjectStatus = 'Idea' | 'Scripted' | 'Filmed' | 'Edited' | 'Published';

export interface Project {
  id: string;
  creator_id: string;
  title: string;
  status: ProjectStatus;
  brief: string;
  primary_product_id?: string;
  created_at: string;
  updated_at: string;
}

export type AssetType =
  | 'titles'
  | 'description'
  | 'tags'
  | 'pinned_comment'
  | 'shorts_caption'
  | 'instagram_caption'
  | 'script_outline'
  | 'thumbnail_ideas'
  | 'community_post'
  | 'compliance_report';

export interface ProjectAsset {
  id: string;
  project_id: string;
  creator_id: string;
  type: AssetType;
  current_version_id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  version_number: number;
  content: string;
  prompt_trigger?: string;
  created_at: string;
}

// ==========================================
// PRODUCTS & AMAZON
// ==========================================

export interface Product {
  id: string;
  creator_id: string;
  asin: string;
  title: string;
  price_str: string;
  price_timestamp: string;
  currency: string;
  image_url: string;
  product_url: string;
  features_json?: string; // JSON array of string
  specs_json?: string; // JSON object
  pros_cons_json?: string; // JSON { pros: [], cons: [] }
  is_mock: number;
  availability: string;
  last_checked_at?: string;
  created_at: string;
}

export interface AffiliateLink {
  id: string;
  creator_id: string;
  project_id?: string;
  product_id?: string;
  tracking_id: string;
  original_url: string;
  tagged_url: string;
  created_at: string;
}

export interface EarningsReport {
  id: string;
  creator_id: string;
  report_date: string;
  asin?: string;
  product_title?: string;
  items_ordered: number;
  items_shipped: number;
  revenue: number;
  commission: number;
  created_at: string;
}

// ==========================================
// SHORT LINKS & BIO
// ==========================================

export interface ShortLink {
  id: string;
  creator_id: string;
  slug: string;
  destination_url: string;
  destination_domain: string;
  title?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  expires_at?: string;
  total_clicks: number;
  created_at: string;
}

export interface LinkClick {
  id: string;
  short_link_id?: string;
  bio_block_id?: string;
  creator_id: string;
  country: string;
  device: string;
  referrer: string;
  ip_hash?: string;
  user_agent?: string;
  created_at: string;
}

export type BioTheme = 'dna-accent' | 'minimal-dark' | 'cyber-neon' | 'warm-editorial';

export interface BioPage {
  id: string;
  creator_id: string;
  handle: string;
  theme: BioTheme;
  custom_title?: string;
  custom_bio?: string;
  accent_color: string;
  bg_color: string;
  is_published: number;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export type BioBlockType = 'link' | 'product_card' | 'social_links' | 'text' | 'divider';

export interface BioBlock {
  id: string;
  bio_page_id: string;
  type: BioBlockType;
  order_index: number;
  title?: string;
  url?: string;
  product_id?: string;
  content_json?: string;
  is_active: number;
  clicks_count: number;
  created_at: string;
  product?: Product;
}

// ==========================================
// PROVIDER SETTINGS & CREDENTIALS
// ==========================================

export interface ProviderSettings {
  id: string;
  creator_id: string;
  preferred_general_provider: 'claude' | 'openai' | 'workers-ai';
  preferred_fast_provider: string;
  preferred_structured_provider: string;
  preferred_video_provider: string;
  daily_budget_usd: number;
  created_at: string;
  updated_at: string;
}

export interface EncryptedCredentials {
  id: string;
  creator_id: string;
  amazon_access_key_enc?: string;
  amazon_secret_key_enc?: string;
  amazon_partner_tag?: string;
  amazon_marketplace: string;
  iv?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// REQUEST / RESPONSE VALIDATION SCHEMAS
// ==========================================

export const CreateShortLinkSchema = z.object({
  destination_url: z.string().url(),
  slug: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Alphanumeric, dashes, and underscores only').optional(),
  title: z.string().max(128).optional(),
  utm_source: z.string().max(64).optional(),
  utm_medium: z.string().max(64).optional(),
  utm_campaign: z.string().max(64).optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

export const UpdateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['Idea', 'Scripted', 'Filmed', 'Edited', 'Published']).optional(),
  brief: z.string().optional(),
});

export const StudioChatSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1),
  productAsin: z.string().optional(),
});

export const OnboardingSchema = z.object({
  platform: z.enum(['youtube', 'instagram']),
  urlOrHandle: z.string().min(2),
  consent: z.literal(true, {
    message: 'Consent is required to analyze channel data',
  }),
});

export const ToolGeneratorSchema = z.object({
  toolType: z.enum(['hook', 'script', 'thumbnail', 'caption_hashtag']),
  topic: z.string().min(2),
  targetProduct: z.string().optional(),
  platform: z.enum(['youtube', 'shorts', 'reels', 'instagram']).default('youtube'),
});
