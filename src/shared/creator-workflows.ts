export const projectPlacements = {
  description: 'Video description',
  pinned_comment: 'Pinned comment',
  bio: 'Link in bio',
} as const;

export interface ProjectPlacementLink {
  destination: string;
  placement: keyof typeof projectPlacements;
  slug: string;
  clicks: number;
}

export interface PublishedVideo {
  id: string;
  title: string;
  views: number;
  url: string | null;
  publishedAt: string | null;
  snapshot: { views: number; sampledAt: string } | null;
}

export interface PublicationReview {
  video: PublishedVideo | null;
  baseline: { median: number; uploads: number } | null;
  nextStep: string;
}

export interface ClipMatch {
  title: string;
  url: string;
  start: number;
  excerpt: string;
  opening: string;
}
export interface ScriptReviewNote {
  line: number;
  issue: string;
  replacement: string;
}

export const brainStates = ['pinned', 'dismissed', 'corrected', 'preference'] as const;
export interface BrainControl {
  key: string;
  type: string;
  label: string;
  state: (typeof brainStates)[number];
  note: string;
}
export interface BrainFinding {
  id: string;
  key: string;
  type: string;
  label: string;
  description: string | null;
  sources: { title: string; url: string }[];
}

export interface PlanAction {
  id: string;
  title: string;
  reason: string;
  tab: 'studio' | 'deals' | 'library';
  projectId?: string;
}

export interface WatchSnapshot {
  channel: string;
  url: string;
  checkedAt: string;
  uploads: { id: string; title: string; url: string; views: number; publishedAt?: string }[];
  outliers: { title: string; url: string; ratio: number }[];
}
export interface WatchReview {
  current: WatchSnapshot;
  previousCheckedAt: string | null;
  newUploads: WatchSnapshot['uploads'];
}
