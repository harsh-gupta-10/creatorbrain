import type {
  Creator,
  CreatorDNA,
  GraphData,
  Learning,
  Lesson,
  Quiz,
  AgentTrace,
  Project,
  ProjectAsset,
  Product,
  ShortLink,
  LinkClick,
  BioPage,
  BioBlock,
  ProviderSettings,
  EarningsReport,
} from '../../shared/types';

const BASE_URL = '';

export interface Monetization {
  amazon?: boolean;
  partnerTag?: string;
  marketplace?: string;
  other?: string[];
}

export interface OnboardingProfile {
  niche: string;
  language: string;
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  youtube: string;
  instagram: string;
  instagramCaptions: string[];
  amazon: { enabled: boolean; partnerTag: string; marketplace: string };
  otherIncome: string[];
  goals: string[];
}

export interface StudyJob {
  id: string;
  created_at?: string;
  channel_url?: string;
  status: 'running' | 'completed' | 'failed';
  current_step: string;
  progress_percent: number;
  result_json?: string;
  error_message?: string;
}

export interface ContentItem {
  id: string;
  platform: 'youtube' | 'instagram';
  external_id: string;
  title: string;
  description?: string;
  url?: string;
  thumbnail_url?: string;
  views: number;
  likes: number;
  published_at?: string;
}

/** Thrown for API errors; `sample` is true when the read-only sample workspace blocked a write */
export class ApiError extends Error {
  status: number;
  sample: boolean;
  constructor(message: string, status: number, sample = false) {
    super(message);
    this.status = status;
    this.sample = sample;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    let sample = false;
    try {
      const errData = (await res.json()) as { error?: string; sample?: boolean };
      if (errData?.error) errorMsg = errData.error;
      sample = !!errData?.sample;
    } catch {
      // ignore
    }
    throw new ApiError(errorMsg, res.status, sample);
  }

  return (await res.json()) as T;
}

export interface LibraryItem {
  id: string;
  platform: 'youtube' | 'instagram';
  external_id: string;
  title: string;
  url?: string;
  thumbnail_url?: string;
  views: number;
  likes: number;
  comments?: number;
  duration_seconds?: number;
  published_at?: string;
  analysis_status: 'pending' | 'done' | 'failed';
  analyzed_by?: string;
  analyzed_at?: string;
  transcript_source?: string;
  hook_type?: string;
  packaging_score?: number;
  topics_json?: string;
}

export interface VideoAnalysis {
  summary: string;
  hook: { text: string; type: string; strength: number; note: string };
  structure: { at: string; label: string }[];
  topics: string[];
  tone: string;
  pacing: string;
  calls_to_action: string[];
  products_mentioned: string[];
  catchphrases: string[];
  title: { pattern: string; note: string };
  thumbnail: { text_overlay: string; faces: string; emotion: string; colors: string[]; composition: string; note: string };
  what_worked: string[];
  to_improve: string[];
  packaging_score: number;
}

export interface LibraryItemDetail extends LibraryItem {
  description?: string;
  transcript: { start: number; text: string }[];
  tags: string[];
  analysis: VideoAnalysis | null;
  thumbnail_analysis: (VideoAnalysis['thumbnail'] & { vision_notes?: string }) | null;
  analysis_error?: string;
}

export const api = {
  content: {
    list: (params: { status?: string; platform?: string } = {}) =>
      fetchJson<{ items: LibraryItem[]; counts: Record<string, number> }>(
        `/api/content?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`
      ),
    get: (id: string) => fetchJson<{ item: LibraryItemDetail }>(`/api/content/${encodeURIComponent(id)}`),
    analyzeNext: (id?: string) =>
      fetchJson<{ done: boolean; id?: string; status?: string; error?: string; remaining: number }>(
        `/api/content/analyze-next${id ? `?id=${encodeURIComponent(id)}` : ''}`,
        { method: 'POST' }
      ),
  },
  auth: {
    me: () =>
      fetchJson<{ authenticated: boolean; isDemo: boolean; isSample: boolean; creator: Creator | null }>('/api/auth/me'),
    sample: () => fetchJson<{ success: boolean; isSample: boolean; creator: Creator }>('/api/auth/sample', { method: 'POST' }),
    login: (body: { email: string; password: string }) =>
      fetchJson<{ success: boolean; creator: Creator }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    signup: (body: { name: string; handle: string; email: string; password: string }) =>
      fetchJson<{ success: boolean; creator: Creator }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    handleAvailable: (handle: string) =>
      fetchJson<{ available: boolean }>(`/api/auth/handle-available?handle=${encodeURIComponent(handle)}`),
    logout: () => fetchJson<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  },
  onboarding: {
    saveProfile: (body: OnboardingProfile) =>
      fetchJson<{ success: boolean }>('/api/onboarding/profile', { method: 'POST', body: JSON.stringify(body) }),
    startStudy: () =>
      fetchJson<{ success: boolean; jobId: string; steps: { id: string; label: string }[] }>('/api/onboarding/study/start', {
        method: 'POST',
      }),
    runStep: (jobId: string) =>
      fetchJson<{ job: StudyJob; busy?: boolean }>('/api/onboarding/study/step', { method: 'POST', body: JSON.stringify({ jobId }) }),
    getJob: (jobId: string) => fetchJson<{ job: StudyJob }>(`/api/onboarding/job/${jobId}`),
    activeStudy: () => fetchJson<{ job: StudyJob | null }>('/api/onboarding/study/active'),
    updateChannel: (youtube: string) =>
      fetchJson<{ success: boolean }>('/api/onboarding/channel', { method: 'PUT', body: JSON.stringify({ youtube }) }),
    getContent: () =>
      fetchJson<{
        items: ContentItem[];
        stats: { count: number; medianViews: number; avgTitleLength: number; uploadsPerMonth: number; topWords: string[] };
        lastStudiedAt: string | null;
      }>('/api/onboarding/content'),
  },
  studio: {
    getProjects: () => fetchJson<{ projects: Project[] }>('/api/studio/projects'),
    createProject: (body: { title: string; brief: string; status?: string }) =>
      fetchJson<{ project: Project }>('/api/studio/projects', { method: 'POST', body: JSON.stringify(body) }),
    getProject: (id: string) => fetchJson<{ project: Project; assets: ProjectAsset[] }>(`/api/studio/projects/${id}`),
    updateProject: (id: string, updates: Partial<Project>) =>
      fetchJson<{ project: Project }>(`/api/studio/projects/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    editAsset: (id: string, body: { content: string; title?: string }) =>
      fetchJson<{ success: boolean; versionId: string; nextVer: number }>(`/api/studio/assets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    chat: (body: { projectId: string; message: string; productAsin?: string }) =>
      fetchJson<{
        reply: string;
        product: Product | null;
        shortLink: string | null;
        compliance: Record<string, unknown>;
        assets: ProjectAsset[];
        project: Project;
      }>('/api/studio/chat', { method: 'POST', body: JSON.stringify(body) }),
  },
  bio: {
    getMe: () => fetchJson<{ creator: Creator; bioPage: BioPage; blocks: BioBlock[] }>('/api/bio/me'),
    updatePage: (body: Partial<BioPage>) =>
      fetchJson<{ success: boolean; bioPage: BioPage }>('/api/bio/page', { method: 'PUT', body: JSON.stringify(body) }),
    updateBlocks: (blocks: BioBlock[]) =>
      fetchJson<{ success: boolean; blocks: BioBlock[] }>('/api/bio/blocks', { method: 'PUT', body: JSON.stringify({ blocks }) }),
  },
  links: {
    getLinks: () => fetchJson<{ links: ShortLink[] }>('/api/links'),
    createLink: (body: Partial<ShortLink>) =>
      fetchJson<{ success: boolean; shortLink: ShortLink; shortUrl: string }>('/api/links/create', { method: 'POST', body: JSON.stringify(body) }),
    getLinkDetails: (id: string) =>
      fetchJson<{ link: ShortLink; clicks: LinkClick[] }>(`/api/links/${id}`),
    reportAbuse: (body: { slug: string; reason?: string }) =>
      fetchJson<{ success: boolean; message: string }>('/api/links/report-abuse', { method: 'POST', body: JSON.stringify(body) }),
  },
  amazon: {
    getProducts: () =>
      fetchJson<{ products: Product[]; isMock: boolean; marketplace: string; partnerTag: string }>('/api/amazon/products'),
    search: (query: string) =>
      fetchJson<{ results: Product[]; isMock: boolean; query: string; marketplace: string }>(`/api/amazon/search?q=${encodeURIComponent(query)}`),
    importProduct: (product: Partial<Product>) =>
      fetchJson<{ success: boolean; product: Product }>('/api/amazon/import', { method: 'POST', body: JSON.stringify(product) }),
    buildLink: (body: { productUrl: string; customTag?: string }) =>
      fetchJson<{ taggedUrl: string; disclosure: string; tag: string }>('/api/amazon/build-link', { method: 'POST', body: JSON.stringify(body) }),
    getEarnings: () =>
      fetchJson<{ earnings: EarningsReport[]; summary: { totalRevenue: number; totalCommission: number; totalItems: number } }>('/api/amazon/earnings'),
    importEarningsCsv: (csvText: string) =>
      fetchJson<{ success: boolean; importedCount: number }>('/api/amazon/earnings/import-csv', { method: 'POST', body: JSON.stringify({ csvText }) }),
    healthCheck: () =>
      fetchJson<{ success: boolean; checkedCount: number; status: string }>('/api/amazon/health-check', { method: 'POST' }),
  },
  brain: {
    getGraph: () =>
      fetchJson<{ graph: GraphData; learnings: Learning[]; nodeCounts: Record<string, number>; creatorDNA: CreatorDNA | null }>('/api/brain/graph'),
    getLearnings: () => fetchJson<{ learnings: Learning[] }>('/api/brain/learnings'),
  },
  learn: {
    getLessons: () =>
      fetchJson<{ lessons: Lesson[]; completedCount: number; totalCount: number; progressPercent: number }>('/api/learn/lessons'),
    completeLesson: (id: string) =>
      fetchJson<{ success: boolean; lessons: Lesson[] }>(`/api/learn/lessons/${id}/complete`, { method: 'POST' }),
    tutorChat: (message: string) =>
      fetchJson<{ reply: string }>('/api/learn/tutor', { method: 'POST', body: JSON.stringify({ message }) }),
  },
  assess: {
    getQuizzes: () => fetchJson<{ quizzes: Quiz[] }>('/api/assess/quizzes'),
    submitQuiz: (id: string, answers: Record<string, number>) =>
      fetchJson<{ success: boolean; score: number; total: number; gapImproved: boolean }>(`/api/assess/quizzes/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  },
  tools: {
    generate: (body: { toolType: string; topic: string; targetProduct?: string; platform?: string }) =>
      fetchJson<{ toolType: string; topic: string; platform: string; output: string }>('/api/tools/generate', { method: 'POST', body: JSON.stringify(body) }),
  },
  agents: {
    getTraces: () => fetchJson<{ traces: AgentTrace[] }>('/api/agents/traces'),
    runNow: () =>
      fetchJson<{ success: boolean; nextBestAction: string; learning: string; traces: AgentTrace[] }>('/api/agents/run-now', { method: 'POST' }),
  },
  settings: {
    getSettings: () =>
      fetchJson<{
        availableProviders: { claude: boolean; openai: boolean; gemini: boolean; workersAi: boolean };
        providerSettings: ProviderSettings;
        currentDailyUsageUsd: number;
        amazonConfig: { hasCredentials: boolean; partnerTag: string; marketplace: string; accessKeyHint?: string };
        creator: Creator;
        monetization: Monetization;
        goals: string[];
      }>('/api/settings'),
    updateProviders: (body: Partial<ProviderSettings>) =>
      fetchJson<{ success: boolean; providerSettings: ProviderSettings }>('/api/settings/providers', { method: 'PUT', body: JSON.stringify(body) }),
    updateAmazon: (body: { accessKey?: string; secretKey?: string; partnerTag: string; marketplace?: string }) =>
      fetchJson<{ success: boolean; message: string; hasCredentials: boolean; partnerTag: string; marketplace: string }>('/api/settings/amazon', { method: 'PUT', body: JSON.stringify(body) }),
    updateMonetization: (body: Monetization) =>
      fetchJson<{ success: boolean; monetization: Monetization }>('/api/settings/monetization', { method: 'PUT', body: JSON.stringify(body) }),
    deleteData: () => fetchJson<{ success: boolean; message: string }>('/api/settings/delete-data', { method: 'POST' }),
  },
  copilot: {
    chat: (body: {
      message: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      mode?: 'brainstorm' | 'script' | 'review' | 'strategy';
    }) =>
      fetchJson<{
        reply: string;
        detectedProduct: Product | null;
        proposedProject: { title: string; brief: string } | null;
        suggestedPrompts: string[];
      }>('/api/copilot/chat', { method: 'POST', body: JSON.stringify(body) }),
  },
};
