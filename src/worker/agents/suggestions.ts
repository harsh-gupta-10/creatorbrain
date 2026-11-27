import {
  WORKSPACE_TOOLS,
  type ChatSuggestion,
  type ToolMemory,
  type WorkspaceTool,
} from '../../shared/chat-suggestions';
import type { Project } from '../../shared/types';
import { loadThread } from '../lib/chats';
import { readToolMemory, readWorkspaceEvidence } from '../lib/workspace-evidence';

const choices: Partial<Record<WorkspaceTool, { id: string; label: string; draft: (topic: string) => string }>> = {
  hook: {
    id: 'script',
    label: 'Draft a script outline',
    draft: (topic) =>
      `/tool script for ${topic}. Give me a few opening options and structure the outline around the strongest one.`,
  },
  script: { id: 'thumbnails', label: 'Plan the thumbnail', draft: (topic) => `/tool thumbnail for ${topic}` },
  thumbnail: {
    id: 'titles',
    label: 'Pair titles with the thumbnail',
    draft: (topic) => `Draft title options for ${topic} that work with a clear thumbnail.`,
  },
  caption_hashtag: { id: 'hook', label: 'Write a stronger opener', draft: (topic) => `/tool hook for ${topic}` },
};

export async function getChatSuggestions(db: D1Database, creatorId: string, project?: Pick<Project, 'id' | 'title'>) {
  const [history, memory, evidence, assets] = await Promise.all([
    loadThread(db, creatorId, project ? `studio:${project.id}` : 'copilot', 4),
    readToolMemory(db, creatorId),
    readWorkspaceEvidence(db, creatorId),
    project
      ? db
          .prepare('SELECT DISTINCT type FROM assets WHERE creator_id=? AND project_id=?')
          .bind(creatorId, project.id)
          .all<{ type: string }>()
      : null,
  ]);
  const suggestions: ChatSuggestion[] = [];
  const add = (value: ChatSuggestion) => {
    if (!suggestions.some((item) => item.id === value.id)) suggestions.push(value);
  };
  const relevantWords = project?.title.toLowerCase().match(/[\p{L}\d]{4,}/gu) || [];
  const signal =
    evidence.signals.find((item) => relevantWords.some((word) => item.label.toLowerCase().includes(word))) ||
    evidence.signals.find((item) => item.type === 'Strength' || item.type === 'Hook') ||
    evidence.signals.find((item) => item.type === 'Topic' || item.type === 'Gap' || item.type === 'Style');
  const video = evidence.topRecentUpload;
  const toolRequest = [...history]
    .reverse()
    .find((item) => item.role === 'user' && /^\/tool\s+\w+\s+/i.test(item.content));
  const toolTopic = toolRequest?.content.replace(/^\/tool\s+\w+\s+(?:for\s+)?/i, '').slice(0, 180);
  const topic =
    project?.title.slice(0, 180) ||
    toolTopic ||
    video?.title.slice(0, 180) ||
    signal?.label.slice(0, 180) ||
    'my next video';
  const latest = [...history].reverse().find((item) => item.role === 'assistant' && !item.meta?.observational);
  const latestAffiliate = latest?.meta?.affiliateLinks;
  if (Array.isArray(latestAffiliate) && latestAffiliate.length === 1 && typeof latestAffiliate[0] === 'string') {
    add({
      id: 'short-link',
      label: 'Shorten the Amazon link',
      prompt: 'Make this a short link',
      reason: 'The last reply contains one affiliate URL.',
    });
  }
  const shortLink = typeof latest?.meta?.shortLink === 'string' ? URL.parse(latest.meta.shortLink) : null;
  if (shortLink && /^\/s\/[\w-]{2,64}$/.test(shortLink.pathname)) {
    add({
      id: 'clicks',
      label: 'Check clicks on this link',
      prompt: `/link-stats ${shortLink.pathname.slice(3)}`,
      reason: 'This conversation created or reused a short link.',
    });
  }
  const recent = memory.find((item: ToolMemory) => choices[item.tool]);
  if (recent) {
    const next = choices[recent.tool]!;
    add({
      id: next.id,
      label: next.label,
      prompt: next.draft(topic),
      reason: `You’ve used ${WORKSPACE_TOOLS[recent.tool].toLowerCase()}.`,
    });
  }
  if (signal) {
    const scope = project ? `“${project.title.slice(0, 180)}”` : 'my next video';
    add({
      id: 'brain',
      label: signal.type === 'Gap' ? 'Work on a Brain finding' : 'Use a Brain finding',
      prompt: `Use the Brain finding “${signal.label.slice(0, 180)}” to suggest a concrete opening or angle for ${scope}.`,
      reason: `Brain recorded “${signal.label.slice(0, 100)}”.`,
    });
  }
  if (video) {
    add({
      id: 'video',
      label: project ? 'Adapt a format from your library' : 'Plan a follow-up video',
      prompt: `Review the structure of my upload “${video.title.slice(0, 180)}”. Suggest a useful ${project ? `way to adapt it for “${project.title.slice(0, 180)}”` : 'follow-up video'}.`,
      reason: `${video.views.toLocaleString('en-US')} recorded views on “${video.title.slice(0, 100)}”.`,
    });
  }
  const link = evidence.topActiveLink;
  if (link && !project) {
    add({
      id: 'clicks',
      label: 'Review your top tracked link',
      prompt: `/link-stats ${link.slug}`,
      reason: `${link.clicks.toLocaleString('en-US')} tracked clicks to ${link.domain}.`,
    });
  }
  if (project) {
    const hasShort = assets?.results.some((asset) => asset.type === 'short_script');
    add({
      id: 'script',
      label: hasShort ? 'Refine the Short opening' : 'Draft a 45-second Short',
      prompt: hasShort
        ? 'Revise the opening of the existing 45-second Short for this project.'
        : 'Write a 45-second Short for this project in my voice.',
      reason: hasShort
        ? 'A Short script is already saved in this project.'
        : 'Uses the brief and your available channel examples.',
    });
  } else if (!suggestions.length) {
    add({
      id: 'idea',
      label: 'Shape a video idea',
      prompt: 'Help me develop my next video. Ask what I want viewers to learn.',
      reason: 'Start with an idea or study your channel to get personalized prompts.',
    });
  }
  return suggestions.slice(0, 3);
}
