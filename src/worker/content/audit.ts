// Free channel audit: a score, four category scores, a posting heatmap and three
// concrete fixes, computed only from a channel's public uploads feed. Deterministic,
// so it costs no AI usage and never invents numbers.

import type { FetchedChannel, FetchedVideo } from './youtube';

export interface AuditCategory {
  key: 'consistency' | 'packaging' | 'reach' | 'momentum';
  label: string;
  score: number; // 0..100
  detail: string;
}

export interface ChannelAudit {
  channel: { id: string; title: string; url: string; avatarUrl?: string; subscribers?: number };
  score: number;
  categories: AuditCategory[];
  fixes: { title: string; detail: string }[];
  heatmap: { weekday: number; count: number; medianViews: number }[]; // 0 = Sunday
  stats: {
    videos: number;
    medianViews: number;
    uploadsPerMonth: number;
    daysSinceLastUpload: number;
    avgTitleLength: number;
    numberShare: number;
  };
  outliers: { id: string; title: string; url: string; thumbnailUrl: string; views: number; ratio: number }[];
  generatedAt: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const DAY = 86_400_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function auditChannel(channel: FetchedChannel, now = new Date()): ChannelAudit {
  const videos = [...channel.videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (!videos.length) throw new Error('This channel has no public uploads to audit yet');

  const views = videos.map((v) => v.views);
  const med = median(views);
  const times = videos.map((v) => Date.parse(v.publishedAt)).filter((t) => !Number.isNaN(t));
  const spanDays = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / DAY : 30;
  const uploadsPerMonth = Math.round((videos.length / Math.max(spanDays, 7)) * 30 * 10) / 10;
  const daysSinceLast = Math.floor((now.getTime() - Math.max(...times)) / DAY);
  const gaps = times.slice(0, -1).map((t, i) => (t - times[i + 1]) / DAY);
  const meanGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  const gapSpread = gaps.length > 1 ? Math.sqrt(gaps.reduce((a, g) => a + (g - meanGap) ** 2, 0) / gaps.length) / Math.max(meanGap, 1) : 0;

  const titleLens = videos.map((v) => v.title.length);
  const avgTitle = Math.round(titleLens.reduce((a, b) => a + b, 0) / titleLens.length);
  const numberShare = videos.filter((v) => /\d/.test(v.title)).length / videos.length;
  const longShare = videos.filter((v) => v.title.length > 60).length / videos.length;

  const recent = views.slice(0, Math.min(5, views.length));
  const older = views.slice(5);
  const momentumRatio = older.length ? median(recent) / Math.max(1, median(older)) : 1;
  const reachRatio = channel.subscribers ? med / channel.subscribers : undefined;

  // ---- Category scores ----
  const consistency = clamp(
    Math.min(uploadsPerMonth / 4, 1) * 55 + (1 - Math.min(gapSpread, 1)) * 25 + (daysSinceLast <= 14 ? 20 : daysSinceLast <= 30 ? 10 : 0)
  );
  const packaging = clamp(
    (avgTitle >= 30 && avgTitle <= 60 ? 45 : avgTitle < 30 ? 30 : Math.max(10, 45 - (avgTitle - 60))) +
      Math.min(numberShare / 0.4, 1) * 30 +
      (1 - longShare) * 25
  );
  const reach = clamp(
    reachRatio === undefined ? 50 : reachRatio >= 0.3 ? 100 : reachRatio >= 0.1 ? 60 + ((reachRatio - 0.1) / 0.2) * 40 : (reachRatio / 0.1) * 60
  );
  const momentum = clamp(momentumRatio >= 1.5 ? 100 : momentumRatio >= 1 ? 70 + ((momentumRatio - 1) / 0.5) * 30 : momentumRatio * 70);

  const categories: AuditCategory[] = [
    {
      key: 'consistency',
      label: 'Consistency',
      score: consistency,
      detail: `${uploadsPerMonth} uploads a month, last one ${daysSinceLast === 0 ? 'today' : `${daysSinceLast} days ago`}`,
    },
    {
      key: 'packaging',
      label: 'Titles',
      score: packaging,
      detail: `Titles average ${avgTitle} characters; ${Math.round(numberShare * 100)}% use a number`,
    },
    {
      key: 'reach',
      label: 'Reach',
      score: reach,
      detail:
        reachRatio === undefined
          ? `Median ${med.toLocaleString('en-US')} views per upload`
          : `Median views are ${Math.round(reachRatio * 100)}% of subscribers`,
    },
    {
      key: 'momentum',
      label: 'Momentum',
      score: momentum,
      detail: older.length
        ? `Last 5 uploads at ${Math.round(momentumRatio * 100)}% of the earlier median`
        : 'Not enough uploads to compare yet',
    },
  ];
  const score = clamp(consistency * 0.3 + packaging * 0.25 + reach * 0.25 + momentum * 0.2);

  // ---- Heatmap ----
  const byDay = WEEKDAYS.map((_, d) => videos.filter((v) => new Date(v.publishedAt).getUTCDay() === d));
  const heatmap = byDay.map((vs, weekday) => ({ weekday, count: vs.length, medianViews: median(vs.map((v) => v.views)) }));

  // ---- Outliers ----
  const outliers = [...videos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 3)
    .map((v: FetchedVideo) => ({
      id: v.id,
      title: v.title,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      views: v.views,
      ratio: Math.round((v.views / Math.max(1, med)) * 10) / 10,
    }));

  // ---- Fixes: the three weakest areas, each with a concrete next step ----
  const bestDay = [...heatmap].filter((h) => h.count > 0).sort((a, b) => b.medianViews - a.medianViews)[0];
  const top = outliers[0];
  const fixLibrary: Record<AuditCategory['key'], { title: string; detail: string }> = {
    consistency: {
      title: 'Pick one upload slot and keep it',
      detail: `You average ${uploadsPerMonth} uploads a month with uneven gaps. ${
        bestDay ? `${WEEKDAYS[bestDay.weekday]} uploads have your best median (${bestDay.medianViews.toLocaleString('en-US')} views), so try a weekly ${WEEKDAYS[bestDay.weekday]} slot.` : 'A fixed weekly slot helps returning viewers.'
      }`,
    },
    packaging: {
      title: avgTitle > 60 ? 'Shorten titles to the mobile cut' : 'Put a concrete number in your titles',
      detail:
        avgTitle > 60
          ? `Your titles average ${avgTitle} characters; mobile feeds cut near 50. Move the payoff to the front.`
          : `Only ${Math.round(numberShare * 100)}% of your titles use a number, price or duration. Try one in each of your next three uploads.`,
    },
    reach: {
      title: 'Package the next video like your top performer',
      detail: top
        ? `"${top.title.slice(0, 70)}" reached ${top.ratio}x your median. Reuse its title shape and thumbnail idea on your next topic.`
        : 'Study your best upload and reuse its title and thumbnail shape.',
    },
    momentum: {
      title: 'Recover recent momentum',
      detail: `Your last five uploads are at ${Math.round(momentumRatio * 100)}% of your earlier median. Revisit the topics that performed before your recent dip.`,
    },
  };
  const fixes = [...categories].sort((a, b) => a.score - b.score).slice(0, 3).map((c) => fixLibrary[c.key]);

  return {
    channel: { id: channel.channelId, title: channel.title, url: channel.url, avatarUrl: channel.avatarUrl, subscribers: channel.subscribers },
    score,
    categories,
    fixes,
    heatmap,
    stats: { videos: videos.length, medianViews: med, uploadsPerMonth, daysSinceLastUpload: daysSinceLast, avgTitleLength: avgTitle, numberShare },
    outliers,
    generatedAt: now.toISOString(),
  };
}
