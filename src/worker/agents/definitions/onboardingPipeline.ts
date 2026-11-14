// Channel study: reads a creator's real published content and turns it into
// Creator DNA, Brain graph nodes, a short lesson plan and a baseline quiz.
// Runs as three short steps so each request stays inside the Workers free tier.

import { z } from 'zod';
import type { AIRouter } from '../../ai/router';
import type { CreatorDNA } from '../../../shared/types';
import { CreatorDNASchema } from '../../../shared/types';
import { fetchYouTubeChannel } from '../../content/youtube';

export type StudyStep = 'fetch' | 'analyze' | 'plan';
export const STUDY_STEPS: StudyStep[] = ['fetch', 'analyze', 'plan'];

export const STEP_LABELS: Record<StudyStep, string> = {
  fetch: 'Reading your latest uploads',
  analyze: 'Learning your voice, packaging and audience',
  plan: 'Building your Brain, lessons and baseline quiz',
};

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
      'SELECT id, platform, title, description, views, likes, published_at FROM content_items WHERE creator_id = ? ORDER BY published_at DESC LIMIT ?'
    )
    .bind(creatorId, limit)
    .all<ContentRow>();
  return results || [];
}

// ------------------------------------------------------------------
// Step 1: fetch
// ------------------------------------------------------------------

export async function refreshYouTubeContent(db: D1Database, creatorId: string, input: string): Promise<number> {
  const channel = await fetchYouTubeChannel(input);
  const ts = now();

  const stmts = channel.videos.map((v) =>
    db
      .prepare(
        `INSERT INTO content_items (id, creator_id, platform, external_id, title, description, url, thumbnail_url, views, likes, published_at, created_at, updated_at)
         VALUES (?, ?, 'youtube', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (creator_id, platform, external_id) DO UPDATE SET
           title = excluded.title, description = excluded.description, views = excluded.views,
           likes = excluded.likes, thumbnail_url = excluded.thumbnail_url, updated_at = excluded.updated_at`
      )
      .bind(uid('ci'), creatorId, v.id, v.title, v.description.slice(0, 2000), v.url, v.thumbnailUrl, v.views, v.likes, v.publishedAt, ts, ts)
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

async function stepFetch(db: D1Database, creator: CreatorRow): Promise<string> {
  let count = 0;
  if (creator.youtube_input) {
    count += await refreshYouTubeContent(db, creator.id, creator.youtube_input);
  }
  const existing = await loadContent(db, creator.id, 50);
  if (existing.length === 0) {
    throw new Error('We found no published content to study. Add a YouTube channel or paste a few Instagram captions');
  }
  return count > 0 ? `Read ${count} recent YouTube uploads` : `Using ${existing.length} pieces of content you added`;
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

async function stepAnalyze(db: D1Database, router: AIRouter, creator: CreatorRow): Promise<string> {
  const items = await loadContent(db, creator.id, 15);
  const stats = computeStats(items);
  const monetization = parseJson<Monetization>(creator.monetization_json, {});
  const goals = parseJson<string[]>(creator.goals_json, []);

  const providers = router.getAvailableProviders();
  const hasAI = providers.claude || providers.openai || providers.gemini || providers.workersAi;

  let study: Study | null = null;
  let usedAI = false;

  if (hasAI) {
    const list = items
      .map(
        (i, n) =>
          `${n + 1}. [${i.platform}] "${i.title}" · ${i.views.toLocaleString('en-US')} views · ${i.published_at?.slice(0, 10) || ''}\n   ${(i.description || '').replace(/\s+/g, ' ').slice(0, 220)}`
      )
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

Recent content:
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

  const dna: CreatorDNA = CreatorDNASchema.parse(study.dna);
  await writeBrain(db, creator.id, dna, study, items, stats);

  await db
    .prepare('UPDATE creators SET dna_summary = ?, niche = COALESCE(NULLIF(niche, \'\'), ?), updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(dna), study.topics[0] || '', now(), creator.id)
    .run();

  return usedAI
    ? `Studied ${items.length} pieces of content with AI`
    : `Studied ${items.length} pieces of content from title and view statistics`;
}

async function writeBrain(
  db: D1Database,
  creatorId: string,
  dna: CreatorDNA,
  study: Study,
  items: ContentRow[],
  stats: Stats
): Promise<void> {
  const ts = now();
  const evidence = JSON.stringify(items.slice(0, 10).map((i) => i.id));
  const bestEvidence = JSON.stringify(stats.best.map((i) => i.id));

  type N = { id: string; type: string; label: string; description: string; confidence: number; evidence: string };
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

  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM edges WHERE creator_id = ?').bind(creatorId),
    db.prepare('DELETE FROM nodes WHERE creator_id = ?').bind(creatorId),
    ...nodes.map((n) =>
      db
        .prepare(
          `INSERT INTO nodes (id, creator_id, type, label, description, confidence, evidence_video_ids, meta, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`
        )
        .bind(n.id, creatorId, n.type, (n.label.charAt(0).toUpperCase() + n.label.slice(1)).slice(0, 160), n.description.slice(0, 400), n.confidence, n.evidence, ts, ts)
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
        `Studied ${stats.count} recent uploads`,
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
  step: StudyStep;
  creatorId: string;
  db: D1Database;
  router: AIRouter;
}): Promise<string> {
  const creator = await loadCreator(options.db, options.creatorId);
  switch (options.step) {
    case 'fetch':
      return stepFetch(options.db, creator);
    case 'analyze':
      return stepAnalyze(options.db, options.router, creator);
    case 'plan':
      return stepPlan(options.db, creator);
  }
}
