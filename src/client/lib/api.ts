import type {
  Creator,
  GraphData,
  Learning,
  Lesson,
  Quiz,
  AgentTrace,
  Project,
  ProjectAsset,
  Product,
  ShortLink,
  BioPage,
  BioBlock,
  ProviderSettings,
  EarningsReport,
} from '../../shared/types';

const BASE_URL = '';

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
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errData = await res.json() as any;
      if (errData?.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return (await res.json()) as T;
}

export const api = {
  auth: {
    me: () => fetchJson<{ authenticated: boolean; isDemo: boolean; creator: Creator | null }>('/api/auth/me'),
    demo: () => fetchJson<{ success: boolean; isDemo: boolean; creator: Creator }>('/api/auth/demo', { method: 'POST' }),
    login: (body: any) => fetchJson<{ success: boolean; creator: Creator }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    signup: (body: any) => fetchJson<{ success: boolean; creator: Creator }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => fetchJson<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  },
  onboarding: {
    start: (body: { platform: string; urlOrHandle: string; consent: boolean }) =>
      fetchJson<{ success: boolean; jobId: string }>('/api/onboarding/start', { method: 'POST', body: JSON.stringify(body) }),
    getJob: (jobId: string) => fetchJson<{ job: any }>(`/api/onboarding/job/${jobId}`),
    instagramLite: (body: { handle: string; sampleCaptions?: string[] }) =>
      fetchJson<{ success: boolean; result: any }>('/api/onboarding/instagram-lite', { method: 'POST', body: JSON.stringify(body) }),
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
      fetchJson<{ reply: string; product: Product | null; shortLink: string | null; compliance: any; assets: ProjectAsset[]; project: Project }>('/api/studio/chat', { method: 'POST', body: JSON.stringify(body) }),
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
    createLink: (body: any) =>
      fetchJson<{ success: boolean; shortLink: ShortLink; shortUrl: string }>('/api/links/create', { method: 'POST', body: JSON.stringify(body) }),
    getLinkDetails: (id: string) =>
      fetchJson<{ link: ShortLink; clicks: any[] }>(`/api/links/${id}`),
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
      fetchJson<{ graph: GraphData; learnings: Learning[]; nodeCounts: any; creatorDNA: any }>('/api/brain/graph'),
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
        amazonConfig: { hasCredentials: boolean; partnerTag: string; marketplace: string };
        creator: Creator;
      }>('/api/settings'),
    updateProviders: (body: Partial<ProviderSettings>) =>
      fetchJson<{ success: boolean; providerSettings: ProviderSettings }>('/api/settings/providers', { method: 'PUT', body: JSON.stringify(body) }),
    updateAmazon: (body: { accessKey?: string; secretKey?: string; partnerTag: string; marketplace?: string }) =>
      fetchJson<{ success: boolean; message: string; hasCredentials: boolean; partnerTag: string; marketplace: string }>('/api/settings/amazon', { method: 'PUT', body: JSON.stringify(body) }),
    deleteData: () => fetchJson<{ success: boolean; message: string }>('/api/settings/delete-data', { method: 'POST' }),
  },
};
