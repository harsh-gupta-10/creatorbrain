// Channel study: reads a creator's real published content and turns it into
// Creator DNA, Brain graph nodes, a short lesson plan and a baseline quiz.
//
//   fetch      list uploads (YouTube Data API when configured, public feed otherwise)
//   video      deep-study one video per call: transcript, thumbnail, structure (repeats)
//   synthesize channel-level voice, strengths and gaps from every per-video breakdown
//   plan       lessons and a baseline quiz from the gaps
//
// Each step is its own short request, so a study never hits Workers free tier limits.

import { z } from 'zod';
import type { AIRouter } from '../../ai/router';
import type { CreatorDNA } from '../../../shared/types';
import { CreatorDNASchema } from '../../../shared/types';
import { fetchYouTubeChannel, fetchChannelWithDataApi, ChannelNotFoundError, type DataApiVideo, type FetchedVideo } from '../../content/youtube';
import { analyzeContentItem, pendingItems, type VideoAnalysis } from '../../content/analyze';
import type { Env } from '../../env';

export type StudyStep = 'fetch' | 'video' | 'synthesize' | 'plan';
export const STUDY_STEPS: StudyStep[] = ['fetch', 'video', 'synthesize', 'plan'];

export const STEP_LABELS: Record<StudyStep, string> = {
  fetch: 'Reading your uploads',
  video: 'Studying each video: transcript, thumbnail, hook and structure',
  synthesize: 'Learning your voice, packaging and audience',
  plan: 'Building your Brain, lessons and baseline quiz',
};

/** Videos deep-studied during one study run; the daily job and the Library pick up the rest */
export const DEEP_PER_STUDY = 12;

interface CreatorRow {
  id: string;
  name: string;
  niche?: string | null;
  youtube_input?: string | null;
  instagram_handle?: string | null;
  content_language?: string | null;
  goals_json?: string | null;
  monetization_json?: string | null;
}

interface ContentRow {
  id: string;
  platform: string;
  title: string;
  description: string | null;
  views: number;
  likes: number;
  published_at: string | null;
  analysis_json?: string | null;
}

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 12)}`;

async function loadCreator(db: D1Database, creatorId: string): Promise<CreatorRow> {
  const row = await db.prepare('SELECT * FROM creators WHERE id = ?').bind(creatorId).first<CreatorRow>();
  if (!row) throw new Error('Creator not found');
  return row;
}

async function loadContent(db: D1Database, creatorId: string, limit = 15): Promise<ContentRow[]> {
  const { results } = await db
    .prepare(
      'SELECT id, platform, title, description, views, likes, published_at, analysis_json FROM content_items WHERE creator_id = ? ORDER BY published_at DESC LIMIT ?'
    )
    .bind(creatorId, limit)
    .all<ContentRow>();
  return results || [];
}

// ------------------------------------------------------------------
// Step 1: fetch
// ------------------------------------------------------------------

export async function refreshYouTubeContent(
  db: D1Database,
  creatorId: string,
  input: string,
  env?: Pick<Env, 'YOUTUBE_API_KEY'>
): Promise<number> {
  const channel = env?.YOUTUBE_API_KEY
    ? await fetchChannelWithDataApi(input, env.YOUTUBE_API_KEY).catch((err) => {
        if (err instanceof ChannelNotFoundError) throw err;
        console.warn('[study] Data API failed, using public feed', err);
        return fetchYouTubeChannel(input);
      })
    : await fetchYouTubeChannel(input);
  const ts = now();

  const stmts = channel.videos.map((v: FetchedVideo & Partial<DataApiVideo>) =>
    db
      .prepare(
        `INSERT INTO content_items (id, creator_id, platform, external_id, title, description, url, thumbnail_url, views, likes,
           comments, duration_seconds, tags_json, published_at, analysis_status, created_at, updated_at)
         VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
         ON CONFLICT (creator_id, platform, external_id) DO UPDATE SET
           title = excluded.title, views = excluded.views, likes = excluded.likes,
           comments = COALESCE(excluded.comments, comments), thumbnail_url = excluded.thumbnail_url,
           duration_seconds = COALESCE(excluded.duration_seconds, duration_seconds),
           tags_json = COALESCE(excluded.tags_json, tags_json),
           description = CASE WHEN length(excluded.description) > length(COALESCE(description, '')) THEN excluded.description ELSE description END,
           updated_at = excluded.updated_at`
      )
      .bind(
        uid('ci'),
        creatorId,
        v.id,
        v.title,
        v.description.slice(0, 5000),
        v.url,
        v.thumbnailUrl,
        v.views,
        v.likes,
        v.comments ?? null,
        v.durationSeconds ?? null,
        v.tags ? JSON.stringify(v.tags) : null,
        v.publishedAt,
        ts,
        ts
      )
  );

  stmts.push(
    db
      .prepare(
        `UPDATE creators SET youtube_channel_id = ?, channel_title = ?, channel_url = ?,
           avatar_url = COALESCE(?, avatar_url), subscribers = COALESCE(?, subscribers), updated_at = ?
         WHERE id = ?`
      )
      .bind(channel.channelId, channel.title, channel.url, channel.avatarUrl ?? null, channel.subscribers ?? null, ts, creatorId)
  );

  await db.batch(stmts);
  return channel.videos.length;
}

export interface FetchResult {
  summary: string;
  /** Set when the YouTube channel could not be found but other content (captions) can still be studied */
  channelError?: string;
  /** Videos this run will deep-study */
  toStudy: number;
}

export async function stepFetch(db: D1Database, env: Env, creatorId: string): Promise<FetchResult> {
  const creator = await loadCreator(db, creatorId);
  let count = 0;
  let channelError: string | undefined;
  if (creator.youtube_input) {
    try {
      count = await refreshYouTubeContent(db, creator.id, creator.youtube_input, env);
    } catch (err) {
      if (!(err instanceof ChannelNotFoundError)) throw err;
      channelError = err.message;
    }
  }
  const existing = await loadContent(db, creator.id, 50);
  if (existing.length === 0) {
    // Nothing else to study: surface the channel problem so the creator can fix the link
    if (channelError) throw new ChannelNotFoundError(creator.youtube_input || '');
    throw new Error('We found no published content to study. Add a YouTube channel or paste a few Instagram captions');
  }
  const pending = await pendingItems(db, creator.id, DEEP_PER_STUDY);
  return {
    summary: channelError
      ? `Studying the ${existing.length} captions you added`
      : count > 0
        ? `Found ${count} YouTube uploads`
        : `Using ${existing.length} pieces of content you added`,
    channelError,
    toStudy: pending.length,
  };
}

// ------------------------------------------------------------------
// Step 2: analyze
// ------------------------------------------------------------------

// Models sometimes drop a section; accept a partial DNA and fill gaps from title statistics
const StudySchema = z.object({
  dna: z.record(z.string(), z.any()).catch({}).default({}),
  topics: z.array(z.string()).max(8).default([]),
  strengths: z
    .array(z.object({ label: z.string(), description: z.string() }))
    .min(1)
    .max(4),
  gaps: z
    .array(
      z.object({
        label: z.string(),
        description: z.string(),
        category: z.enum(['Packaging', 'Voice', 'Retention', 'SEO', 'Compliance']).catch('Packaging'),
      })
    )
    .min(1)
    .max(4),
});
type Study = Omit<z.infer<typeof StudySchema>, 'dna'> & { dna: CreatorDNA };

function mergeDna(base: CreatorDNA, ai: Record<string, any>): CreatorDNA {
  const out: any = { ...base };
  for (const section of ['voice', 'visual', 'packaging', 'audience'] as const) {
    const fromAi = ai?.[section];
    if (fromAi && typeof fromAi === 'object') {
      const merged: any = { ...base[section] };
      for (const [k, v] of Object.entries(fromAi)) {
        const baseVal = (base[section] as any)[k];
        if (v === null || v === undefined || v === '') continue;
        if (Array.isArray(baseVal) && !Array.isArray(v)) continue;
        if (typeof baseVal === 'number' && typeof v !== 'number') continue;
        merged[k] = Array.isArray(v) ? v.map(String).slice(0, 8) : typeof baseVal === 'string' ? String(v) : v;
      }
      out[section] = merged;
    }
  }
  const parsed = CreatorDNASchema.safeParse(out);
  return parsed.success ? parsed.data : base;
}

interface Stats {
  count: number;
  avgTitleLength: number;
  medianViews: number;
  questionShare: number;
  numberShare: number;
  topWords: string[];
  best: ContentRow[];
  worst: ContentRow[];
  uploadsPerMonth: number;
}

const STOP = new Set(
  'the a an and or but of to in on for with is it this that my your i you we our at by from vs how what why when best new review video top'.split(' ')
);

export function computeStats(items: ContentRow[]): Stats {
  const titles = items.map((i) => i.title);
  const views = items.map((i) => i.views || 0).sort((a, b) => a - b);
  const words = new Map<string, number>();
  for (const t of titles) {
    for (const w of t.toLowerCase().match(/[a-z][a-z0-9+]{2,}/g) || []) {
      if (!STOP.has(w)) words.set(w, (words.get(w) || 0) + 1);
    }
  }
  const byViews = [...items].sort((a, b) => (b.views || 0) - (a.views || 0));
  const dates = items.map((i) => Date.parse(i.published_at || '')).filter((d) => !Number.isNaN(d));
  const spanDays = dates.length > 1 ? (Math.max(...dates) - Math.min(...dates)) / 86400000 : 30;

  return {
    count: items.length,
    avgTitleLength: Math.round(titles.reduce((a, t) => a + t.length, 0) / Math.max(1, titles.length)),
    medianViews: views.length ? views[Math.floor(views.length / 2)] : 0,
    questionShare: titles.filter((t) => t.includes('?')).length / Math.max(1, titles.length),
    numberShare: titles.filter((t) => /\d/.test(t)).length / Math.max(1, titles.length),
    topWords: [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w),
    best: byViews.slice(0, 3),
    worst: byViews.slice(-3).reverse(),
    uploadsPerMonth: Math.round((items.length / Math.max(spanDays, 1)) * 30 * 10) / 10,
  };
}

// Used when no AI provider is reachable: every line is derived from the real titles
function heuristicStudy(creator: CreatorRow, stats: Stats, monetization: Monetization): Study {
  const lang = creator.content_language || 'English';
  const strengths: Study['strengths'] = [];
  const gaps: Study['gaps'] = [];

  if (stats.best[0]) {
    strengths.push({
      label: `Your top upload: ${stats.best[0].title.slice(0, 60)}`,
      description: `Reached ${stats.best[0].views.toLocaleString('en-US')} views, about ${Math.max(1, Math.round(stats.best[0].views / Math.max(1, stats.medianViews)))}x your median`,
    });
  }
  if (stats.topWords.length) {
    strengths.push({
      label: `Clear topic focus on ${stats.topWords.slice(0, 3).join(', ')}`,
      description: 'These words repeat across your recent titles, so viewers know what to expect',
    });
  }
  if (stats.avgTitleLength > 60) {
    gaps.push({
      label: 'Titles run long for mobile',
      description: `Your titles average ${stats.avgTitleLength} characters; mobile cuts off around 50`,
      category: 'Packaging',
    });
  }
  if (stats.numberShare < 0.2) {
    gaps.push({
      label: 'Few concrete numbers in titles',
      description: 'Only a small share of titles use a number, price or duration, which usually lifts click-through',
      category: 'Packaging',
    });
  }
  if (monetization.amazon) {
    gaps.push({
      label: 'Affiliate disclosure placement',
      description: 'Keep the Amazon disclosure in the first three lines of every description that carries a tagged link',
      category: 'Compliance',
    });
  }
  if (stats.uploadsPerMonth < 2) {
    gaps.push({
      label: 'Upload rhythm',
      description: `About ${stats.uploadsPerMonth} uploads a month recently; a steady weekly slot helps returning viewers`,
      category: 'Retention',
    });
  }
  if (gaps.length === 0) {
    gaps.push({
      label: 'Hook in the first five seconds',
      description: 'Open on the result or the question your title promises before any intro',
      category: 'Retention',
    });
  }

  return {
    topics: stats.topWords.slice(0, 6),
    strengths: strengths.length ? strengths : [{ label: 'Consistent publishing', description: `${stats.count} recent uploads studied` }],
    gaps: gaps.slice(0, 4),
    dna: {
      voice: {
        pace: 'Not measured yet',
        tone: 'Learned from titles only until an AI provider is connected',
        catchphrases: [],
        language_mix: lang,
        hook_formula: stats.questionShare > 0.3 ? 'Question-led titles' : 'Statement-led titles',
      },
      visual: {
        thumbnail_palette: [],
        composition: 'Not analyzed yet',
        text_overlay_words: 3,
      },
      packaging: {
        title_avg_length: stats.avgTitleLength,
        title_patterns: stats.best.map((b) => b.title),
        disclosure_position: monetization.amazon ? 'First three lines of the description' : 'Not applicable',
      },
      audience: {
        primary_demographic: `Viewers interested in ${stats.topWords.slice(0, 3).join(', ') || creator.niche || 'your niche'}`,
        buying_intent: monetization.amazon ? 'Product-led, worth testing with tagged links' : 'Unknown until links are tracked',
      },
    },
  };
}

interface Monetization {
  amazon?: boolean;
  partnerTag?: string;
  marketplace?: string;
  other?: string[];
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------
// Step 2: video (one deep study per call)
// ------------------------------------------------------------------

export async function stepVideo(
  db: D1Database,
  env: Env,
  router: AIRouter,
  creatorId: string,
  done: number
): Promise<{ analyzedTitle?: string; more: boolean; failed: boolean }> {
  if (done >= DEEP_PER_STUDY) return { more: false, failed: false };
  const [next] = await pendingItems(db, creatorId, 1);
  if (!next) return { more: false, failed: false };
  const result = await analyzeContentItem(db, env, router, next);
  const row = await db.prepare('SELECT title FROM content_items WHERE id = ?').bind(next).first<{ title: string }>();
  const remaining = await pendingItems(db, creatorId, 1);
  return { analyzedTitle: row?.title, more: remaining.length > 0 && done + 1 < DEEP_PER_STUDY, failed: result.status === 'failed' };
}

function parseAnalysis(raw?: string | null): VideoAnalysis | null {
  try {
    return raw ? (JSON.parse(raw) as VideoAnalysis) : null;
  } catch {
    return null;
  }
}

/** Counts how often each value appears across per-video breakdowns */
function topicNodes0<T extends { type: string; label: string }>(nodes: T[]): T[] {
  return nodes.filter((n) => n.type === 'Topic');
}

function tally(values: string[], max = 6): string[] {
  const m = new Map<string, { label: string; n: number }>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || key === 'none') continue;
    const e = m.get(key) || { label: v.trim(), n: 0 };
    e.n++;
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, max).map((e) => e.label);
}

// ------------------------------------------------------------------
// Step 3: synthesize
// ------------------------------------------------------------------

async function stepSynthesize(db: D1Database, router: AIRouter, creator: CreatorRow): Promise<string> {
  const items = await loadContent(db, creator.id, 30);
  const stats = computeStats(items);
  const monetization = parseJson<Monetization>(creator.monetization_json, {});
  const goals = parseJson<string[]>(creator.goals_json, []);

  const providers = router.getAvailableProviders();
  const hasAI = providers.claude || providers.openai || providers.gemini || providers.workersAi;

  let study: Study | null = null;
  let usedAI = false;

  const analyses = items.map((i) => ({ item: i, a: parseAnalysis(i.analysis_json) })).filter((x) => x.a) as {
    item: ContentRow;
    a: VideoAnalysis;
  }[];
  const studied = analyses.length;

  if (hasAI) {
    const list = items
      .slice(0, 20)
      .map((i, n) => {
        const a = parseAnalysis(i.analysis_json);
        const head = `${n + 1}. [${i.platform}] "${i.title}" · ${i.views.toLocaleString('en-US')} views · ${i.published_at?.slice(0, 10) || ''}`;
        if (!a) return `${head}\n   ${(i.description || '').replace(/\s+/g, ' ').slice(0, 200)}`;
        return `${head}
   hook (${a.hook.type}): "${a.hook.text.slice(0, 160)}"
   tone: ${a.tone} · pacing: ${a.pacing} · topics: ${a.topics.join(', ')}
   thumbnail: text "${a.thumbnail.text_overlay}", face ${a.thumbnail.faces}, ${a.thumbnail.composition}
   worked: ${a.what_worked.join('; ')} · improve: ${a.to_improve.join('; ')}`;
      })
      .join('\n');

    try {
      const aiStudy = await router.generateStructured(
        [
          {
            role: 'system',
            content:
              'You are a channel strategist studying a creator\'s real recent content. Be specific to the titles given. Never invent numbers that are not in the data. Return JSON only.',
          },
          {
            role: 'user',
            content: `Creator: ${creator.name}
Niche: ${creator.niche || 'unspecified'}
Language: ${creator.content_language || 'unspecified'}
Goals: ${goals.join(', ') || 'unspecified'}
Monetization: ${monetization.amazon ? `Amazon Associates (${monetization.marketplace || 'amazon.com'})` : 'no Amazon'}${monetization.other?.length ? `, ${monetization.other.join(', ')}` : ''}
Median views: ${stats.medianViews}. Average title length: ${stats.avgTitleLength}. Uploads per month: ${stats.uploadsPerMonth}.

Recent content, with per-video breakdowns from transcripts and thumbnails:
${list}

Return JSON with this exact shape:
{"dna":{"voice":{"pace":"","tone":"","catchphrases":[""],"language_mix":"","hook_formula":""},"visual":{"thumbnail_palette":[],"composition":"","text_overlay_words":3},"packaging":{"title_avg_length":${stats.avgTitleLength},"title_patterns":["pattern with [Placeholder]"],"disclosure_position":""},"audience":{"primary_demographic":"","buying_intent":""}},
"topics":["up to 6 recurring topics"],
"strengths":[{"label":"short","description":"one sentence citing a title"}],
"gaps":[{"label":"short","description":"one sentence with a concrete fix","category":"Packaging|Voice|Retention|SEO|Compliance"}]}
Give 2 to 3 strengths and 2 to 3 gaps.`,
          },
        ],
        StudySchema,
        { creatorId: creator.id, maxTokens: 1600, temperature: 0.3 }
      );
      const base = heuristicStudy(creator, stats, monetization);
      study = { ...aiStudy, dna: mergeDna(base.dna, aiStudy.dna) };
      usedAI = true;
    } catch (err) {
      console.warn('[Study] AI analysis failed, using title statistics', err);
    }
  }

  if (!study) study = heuristicStudy(creator, stats, monetization);

  // Fill voice and visual traits straight from the per-video breakdowns
  if (studied) {
    const d = study.dna;
    const catchphrases = tally(analyses.flatMap((x) => x.a.catchphrases), 5);
    const hooks = tally(analyses.map((x) => x.a.hook.type), 2);
    const overlays = analyses.map((x) => x.a.thumbnail.text_overlay).filter((t) => t && !/^none$/i.test(t));
    study.dna = {
      ...d,
      voice: {
        ...d.voice,
        catchphrases: d.voice.catchphrases.length ? d.voice.catchphrases : catchphrases,
        pace: /not measured/i.test(d.voice.pace) ? tally(analyses.map((x) => x.a.pacing), 1)[0] || d.voice.pace : d.voice.pace,
        tone: /titles only/i.test(d.voice.tone) ? tally(analyses.map((x) => x.a.tone), 1)[0] || d.voice.tone : d.voice.tone,
        hook_formula: hooks.length ? `Mostly ${hooks.join(' and ')} openings` : d.voice.hook_formula,
      },
      visual: {
        ...d.visual,
        thumbnail_palette: d.visual.thumbnail_palette.length ? d.visual.thumbnail_palette : tally(analyses.flatMap((x) => x.a.thumbnail.colors), 4),
        composition: /not analyzed/i.test(d.visual.composition) ? tally(analyses.map((x) => x.a.thumbnail.composition), 1)[0] || d.visual.composition : d.visual.composition,
        text_overlay_words: overlays.length
          ? Math.round(overlays.reduce((n, t) => n + t.split(/\s+/).length, 0) / overlays.length)
          : d.visual.text_overlay_words,
      },
    };
    if (!study.topics.length) study.topics = tally(analyses.flatMap((x) => x.a.topics), 6);
  }

  const dna: CreatorDNA = CreatorDNASchema.parse(study.dna);
  await writeBrain(db, creator.id, dna, study, items, stats, analyses);

  await db
    .prepare('UPDATE creators SET dna_summary = ?, niche = COALESCE(NULLIF(niche, \'\'), ?), updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(dna), study.topics[0] || '', now(), creator.id)
    .run();

  const depth = studied ? `, ${studied} in depth` : '';
  return usedAI
    ? `Learned from ${items.length} pieces of content${depth}`
    : `Learned from ${items.length} pieces of content${depth}, using title and view statistics`;
}

async function writeBrain(
  db: D1Database,
  creatorId: string,
  dna: CreatorDNA,
  study: Study,
  items: ContentRow[],
  stats: Stats,
  analyses: { item: ContentRow; a: VideoAnalysis }[] = []
): Promise<void> {
  const ts = now();
  const evidence = JSON.stringify(items.slice(0, 10).map((i) => i.id));
  const bestEvidence = JSON.stringify(stats.best.map((i) => i.id));

  type N = { id: string; type: string; label: string; description: string; confidence: number; evidence: string; itemId?: string };
  const nodes: N[] = [
    { id: uid('node'), type: 'Style', label: dna.voice.tone, description: `Pace: ${dna.voice.pace}`, confidence: 0.8, evidence },
    { id: uid('node'), type: 'Style', label: dna.voice.hook_formula, description: 'How your openings and titles hook viewers', confidence: 0.75, evidence },
    { id: uid('node'), type: 'Audience', label: dna.audience.primary_demographic, description: dna.audience.buying_intent, confidence: 0.7, evidence },
    ...study.strengths.map((s) => ({ id: uid('node'), type: 'Strength', label: s.label, description: s.description, confidence: 0.85, evidence: bestEvidence })),
    ...study.gaps.map((g) => ({ id: uid('node'), type: 'Gap', label: g.label, description: g.description, confidence: 0.7, evidence })),
    ...study.topics.slice(0, 5).map((t) => ({ id: uid('node'), type: 'Topic', label: t, description: 'Recurring topic in your recent content', confidence: 0.8, evidence })),
  ];

  const audience = nodes[2];
  const strengths = nodes.filter((n) => n.type === 'Strength');
  const edges: { source: string; target: string; relation: string; weight: number }[] = [
    { source: nodes[0].id, target: audience.id, relation: 'RELATES_TO', weight: 0.8 },
    ...strengths.map((s) => ({ source: s.id, target: audience.id, relation: 'STRONG_AT', weight: 0.85 })),
    ...nodes
      .filter((n) => n.type === 'Gap')
      .map((g, i) => ({ source: g.id, target: (strengths[i % Math.max(1, strengths.length)] || audience).id, relation: 'NEEDS_WORK', weight: 0.7 })),
    ...nodes.filter((n) => n.type === 'Topic').map((t) => ({ source: t.id, target: audience.id, relation: 'RELATES_TO', weight: 0.6 })),
  ];

  // More topics: anything covered by two or more studied videos joins the Brain
  const knownTopics = new Set(topicNodes0(nodes).map((t) => t.label.toLowerCase()));
  for (const t of tally(analyses.flatMap((x) => x.a.topics), 12)) {
    const covered = analyses.filter((x) => x.a.topics.some((v) => v.toLowerCase() === t.toLowerCase())).length;
    if (covered >= 2 && !knownTopics.has(t.toLowerCase()) && knownTopics.size < 12) {
      knownTopics.add(t.toLowerCase());
      nodes.push({ id: uid('node'), type: 'Topic', label: t, description: `Covered in ${covered} studied videos`, confidence: 0.6 + covered / Math.max(analyses.length, 1) / 3, evidence: '[]' });
    }
  }

  // Traits learned across videos become their own nodes: hook styles, recurring phrases,
  // products, calls to action and thumbnail styles. Each links to the videos that show it.
  const traitNodes = new Map<string, N>();
  const trait = (type: string, rawLabel: string, description: string, confidence: number) => {
    const label = rawLabel.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!label || /^(none|n\/a|unclassified|unknown)$/i.test(label)) return null;
    const key = `${type}:${label.toLowerCase()}`;
    let node = traitNodes.get(key);
    if (!node) {
      node = { id: uid('node'), type, label, description, confidence, evidence: '[]' };
      traitNodes.set(key, node);
    }
    return node;
  };
  const evidenceOf = new Map<string, string[]>();
  const link = (vid: N, target: N | null, relation: string, itemId: string) => {
    if (!target) return;
    edges.push({ source: vid.id, target: target.id, relation, weight: 0.6 });
    evidenceOf.set(target.id, [...(evidenceOf.get(target.id) || []), itemId]);
  };

  // Each deep-studied video becomes a node linked to the topics it covers and, for
  // top performers, to the strengths it is evidence for
  const topicNodes = nodes.filter((n) => n.type === 'Topic');
  const bestIds = new Set(stats.best.map((b) => b.id));
  for (const { item, a } of analyses.slice(0, 25)) {
    const vid: N = {
      id: uid('node'),
      type: 'Video',
      label: item.title,
      description: a.summary || a.hook.text,
      confidence: a.packaging_score,
      evidence: JSON.stringify([item.id]),
      itemId: item.id,
    };
    nodes.push(vid);
    const haystack = `${item.title} ${a.topics.join(' ')}`.toLowerCase();
    for (const t of topicNodes) {
      if (haystack.includes(t.label.toLowerCase())) edges.push({ source: vid.id, target: t.id, relation: 'COVERS', weight: 0.7 });
    }
    if (bestIds.has(item.id)) {
      for (const st of strengths) edges.push({ source: vid.id, target: st.id, relation: 'EVIDENCE_FOR', weight: 0.8 });
    }
    link(vid, trait('Hook', `${a.hook.type} openings`, 'How videos start', 0.7), 'USES', item.id);
    for (const p of a.catchphrases.slice(0, 3)) link(vid, trait('Phrase', `"${p.replace(/^["“]|["”]$/g, '')}"`, 'Something you say again and again', 0.7), 'SAYS', item.id);
    for (const pr of a.products_mentioned.slice(0, 4)) link(vid, trait('Product', pr, 'Mentioned in your videos', 0.65), 'MENTIONS', item.id);
    for (const cta of a.calls_to_action.slice(0, 2)) link(vid, trait('CTA', cta, 'What you ask viewers to do', 0.6), 'ASKS', item.id);
    if (a.thumbnail.composition) link(vid, trait('Thumbnail', a.thumbnail.composition, 'A thumbnail style you use', 0.65), 'LOOKS_LIKE', item.id);
  }

  // Keep traits seen in more than one video (or all of them for small channels), strongest first
  const minSeen = analyses.length >= 6 ? 2 : 1;
  const perType = new Map<string, number>();
  const bySeen = (n: N) => evidenceOf.get(n.id)?.length || 0;
  for (const node of [...traitNodes.values()].sort((x, y) => bySeen(y) - bySeen(x))) {
    const seen = bySeen(node);
    const count = perType.get(node.type) || 0;
    // Repeated traits first; single-video traits fill a type up to 3 so no region is empty
    if ((seen >= minSeen && count < 8) || (seen >= 1 && count < 3)) {
      perType.set(node.type, count + 1);
      node.evidence = JSON.stringify(evidenceOf.get(node.id));
      node.confidence = Math.min(0.95, 0.5 + seen / Math.max(analyses.length, 1) / 2);
      node.description = `${node.description} · seen in ${seen} of ${analyses.length} studied videos`;
      nodes.push(node);
    }
  }
  // Drop edges that point at traits we did not keep
  const kept = new Set(nodes.map((n) => n.id));
  for (let i = edges.length - 1; i >= 0; i--) {
    if (!kept.has(edges[i].target) || !kept.has(edges[i].source)) edges.splice(i, 1);
  }

  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM edges WHERE creator_id = ?').bind(creatorId),
    db.prepare('DELETE FROM nodes WHERE creator_id = ?').bind(creatorId),
    ...nodes.map((n) =>
      db
        .prepare(
          `INSERT INTO nodes (id, creator_id, type, label, description, confidence, evidence_video_ids, meta, content_item_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)`
        )
        .bind(
          n.id,
          creatorId,
          n.type,
          (n.label.charAt(0).toUpperCase() + n.label.slice(1)).slice(0, 160),
          n.description.slice(0, 400),
          n.confidence,
          n.evidence,
          n.itemId ?? null,
          ts,
          ts
        )
    ),
    ...edges.map((e) =>
      db
        .prepare('INSERT INTO edges (id, creator_id, source_id, target_id, relation, weight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(uid('edge'), creatorId, e.source, e.target, e.relation, e.weight, ts)
    ),
    db
      .prepare(`INSERT INTO learnings (id, creator_id, title, insight, source_agent, created_at) VALUES (?, ?, ?, ?, 'Channel Study', ?)`)
      .bind(
        uid('learn'),
        creatorId,
        analyses.length ? `Studied ${analyses.length} videos in depth` : `Studied ${stats.count} recent uploads`,
        `Median ${stats.medianViews.toLocaleString('en-US')} views, titles average ${stats.avgTitleLength} characters, about ${stats.uploadsPerMonth} uploads a month`,
        ts
      ),
  ];
  await db.batch(stmts);
}

// ------------------------------------------------------------------
// Step 3: plan
// ------------------------------------------------------------------

const LESSON_LIBRARY: Record<string, { title: string; body: string }> = {
  Packaging: {
    title: 'Titles that survive the mobile cut',
    body: `Mobile feeds show roughly the first 50 characters of a title.\n\n1. Put the subject and the payoff in those first 50 characters\n2. Use one concrete number: a price, a duration or a count\n3. Move qualifiers like "honest" or "in 2026" to the end\n\n**Try it:** rewrite your last three titles so the payoff lands before character 50.`,
  },
  Retention: {
    title: 'The first five seconds',
    body: `Viewers decide in the opening seconds whether the video keeps the title's promise.\n\n1. Open on the result, the reveal or the question\n2. Skip channel intros and greetings before the hook\n3. Promise one specific thing that comes later and name when\n\n**Try it:** script only the first two sentences of your next video and read them aloud.`,
  },
  Voice: {
    title: 'Say it the way you talk',
    body: `Your best-performing uploads usually sound like you on a good day.\n\n1. Write the outline, not the sentences\n2. Keep your recurring phrases; they are recognition, not filler\n3. Cut anything you would never say to a friend\n\n**Try it:** record a one-minute voice note explaining your next topic, then outline from it.`,
  },
  SEO: {
    title: 'Descriptions that get found',
    body: `Search reads your title, description and chapters.\n\n1. Repeat the main search phrase in the first line of the description\n2. Add chapters with plain, searchable names\n3. Link related uploads at the end\n\n**Try it:** add chapters to your three most viewed videos.`,
  },
  Compliance: {
    title: 'Affiliate disclosure done right',
    body: `Disclosures must be clear and placed where viewers see them before they click.\n\n1. Put "As an Amazon Associate I earn from qualifying purchases" in the first three lines\n2. Say it out loud when you mention the link\n3. Show prices with a date, or tell viewers to check the current price\n\n**Try it:** audit the descriptions of your last five videos with links.`,
  },
};

const QUIZ_BANK: Record<string, { question: string; options: string[]; correctIndex: number; explanation: string }> = {
  Packaging: {
    question: 'Roughly how many characters of a title show in a mobile feed before it is cut?',
    options: ['20', 'About 50', '100', 'All of it'],
    correctIndex: 1,
    explanation: 'Mobile layouts cut titles near 50 characters, so the payoff belongs at the start.',
  },
  Retention: {
    question: 'What belongs in the first five seconds of a video?',
    options: ['A channel intro', 'A request to subscribe', 'The result or question the title promised', 'Background music only'],
    correctIndex: 2,
    explanation: 'Opening on the promised payoff keeps viewers who clicked for it.',
  },
  Voice: {
    question: 'What is the safest way to keep your natural voice in a scripted video?',
    options: ['Read a full script word for word', 'Outline points and speak them in your own words', 'Copy a bigger creator\'s phrasing', 'Avoid recurring phrases'],
    correctIndex: 1,
    explanation: 'An outline keeps structure while the delivery stays yours.',
  },
  SEO: {
    question: 'Which change most helps a video get found in search?',
    options: ['More hashtags', 'The main search phrase in the first line of the description', 'A longer outro', 'Disabling comments'],
    correctIndex: 1,
    explanation: 'Search weighs the opening of the description and the title most.',
  },
  Compliance: {
    question: 'Where should an Amazon affiliate disclosure go in a YouTube description?',
    options: ['At the very bottom', 'In the first three lines, before the links', 'Only in the pinned comment', 'It is optional'],
    correctIndex: 1,
    explanation: 'Disclosures must be visible before viewers click a tagged link.',
  },
  Hook: {
    question: 'Which title is more likely to earn a click on mobile?',
    options: ['My honest and complete thoughts after using it for a while', 'Used it 30 days: 3 things nobody mentions', 'Video #42', 'Watch this'],
    correctIndex: 1,
    explanation: 'Front-loaded, concrete titles with a number read fastest.',
  },
};

async function stepPlan(db: D1Database, creator: CreatorRow): Promise<string> {
  const { results: gapRows } = await db
    .prepare("SELECT id, label, description FROM nodes WHERE creator_id = ? AND type = 'Gap' ORDER BY created_at")
    .bind(creator.id)
    .all<{ id: string; label: string; description: string }>();
  const gaps = gapRows || [];
  const monetization = parseJson<Monetization>(creator.monetization_json, {});

  const categoryFor = (g: { label: string; description: string }) => {
    const t = `${g.label} ${g.description}`.toLowerCase();
    if (/disclos|affiliate|complian/.test(t)) return 'Compliance';
    if (/hook|retention|watch|drop|rhythm|upload/.test(t)) return 'Retention';
    if (/search|seo|description|chapter/.test(t)) return 'SEO';
    if (/voice|tone|delivery/.test(t)) return 'Voice';
    return 'Packaging';
  };

  const categories: string[] = [];
  const lessonGapIds = new Map<string, string>();
  for (const g of gaps) {
    const cat = categoryFor(g);
    if (!categories.includes(cat)) {
      categories.push(cat);
      lessonGapIds.set(cat, g.id);
    }
  }
  for (const cat of ['Retention', 'Packaging', monetization.amazon ? 'Compliance' : 'SEO', 'Voice']) {
    if (categories.length >= 4) break;
    if (!categories.includes(cat)) categories.push(cat);
  }

  const ts = now();
  const quizCats = [...categories.slice(0, 4), 'Hook'];
  const questions = quizCats.map((cat, i) => ({ id: `q${i + 1}`, ...QUIZ_BANK[cat] }));

  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM lessons WHERE creator_id = ? AND completed = 0').bind(creator.id),
    db.prepare("DELETE FROM quizzes WHERE creator_id = ? AND status = 'pending'").bind(creator.id),
    ...categories.map((cat, i) =>
      db
        .prepare(
          `INSERT INTO lessons (id, creator_id, gap_node_id, order_index, title, category, duration_min, content_markdown, completed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 5, ?, 0, ?)`
        )
        .bind(uid('lesson'), creator.id, lessonGapIds.get(cat) || null, i + 1, LESSON_LIBRARY[cat].title, cat, LESSON_LIBRARY[cat].body, ts)
    ),
    db
      .prepare(
        `INSERT INTO quizzes (id, creator_id, gap_node_id, title, questions_json, score, status, created_at)
         VALUES (?, ?, ?, 'Baseline: packaging, retention and compliance', ?, NULL, 'pending', ?)`
      )
      .bind(uid('quiz'), creator.id, gaps[0]?.id || null, JSON.stringify(questions), ts),
    db
      .prepare("UPDATE creators SET onboarding_status = 'ready', last_studied_at = ?, updated_at = ? WHERE id = ?")
      .bind(ts, ts, creator.id),
  ];
  await db.batch(stmts);
  return `Planned ${categories.length} lessons and a ${questions.length}-question baseline`;
}

// ------------------------------------------------------------------

export async function runStudyStep(options: {
  step: Exclude<StudyStep, 'video' | 'fetch'>;
  creatorId: string;
  db: D1Database;
  env: Env;
  router: AIRouter;
}): Promise<string> {
  const creator = await loadCreator(options.db, options.creatorId);
  switch (options.step) {
    case 'synthesize':
      return stepSynthesize(options.db, options.router, creator);
    case 'plan':
      return stepPlan(options.db, creator);
  }
}
