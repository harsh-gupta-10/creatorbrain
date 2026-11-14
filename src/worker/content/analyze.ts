// Deep study of a single video or post.
//
// YouTube: duration, keywords and the timestamped transcript come from YouTube's own
// caption tracks (manual first, then auto-generated). The thumbnail is looked at by a
// vision model. Then a language model reads the transcript, title, thumbnail notes and
// stats and writes a structured breakdown: hook, structure, topics, tone, calls to
// action, products mentioned, what worked and what to improve.
// With GEMINI_API_KEY set, Gemini watches the video itself and the thumbnail in one call.
//
// Instagram: the pasted caption is the "transcript" and gets the same breakdown.
//
// Every engine is optional; with none available the breakdown is built from the
// real transcript and title statistics only, so nothing is invented.

import { z } from 'zod';
import type { AIRouter } from '../ai/router';
import type { Env } from '../env';
import { ANALYSIS_LANGUAGE_RULE } from '../lib/language';
import { fetchTranscript, fetchVideoDetails, formatTimestamp, type TranscriptSegment } from './youtube';

// Missing or null fields become the fallback, never the text "undefined"
const str = (fallback = '') =>
  z.preprocess((v) => (v === null || v === undefined ? fallback : typeof v === 'string' ? v : String(v)), z.string()).catch(fallback);
const strList = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((a) => a.filter((v) => v !== null && v !== undefined && v !== '').map(String).slice(0, max));
const score = z.coerce.number().min(0).max(1).catch(0.5);

export const VideoAnalysisSchema = z.object({
  summary: str(),
  hook: z
    .object({ text: str(), type: str('Unclassified'), strength: score, note: str() })
    .catch({ text: '', type: 'Unclassified', strength: 0.5, note: '' }),
  structure: z
    .array(z.object({ at: str('0:00'), label: str() }))
    .catch([])
    .transform((a) => a.slice(0, 12)),
  topics: strList(8),
  tone: str(),
  pacing: str(),
  calls_to_action: strList(6),
  products_mentioned: strList(10),
  catchphrases: strList(6),
  title: z
    .object({ pattern: str(), note: str() })
    .catch({ pattern: '', note: '' }),
  thumbnail: z
    .object({
      text_overlay: str(),
      faces: str(),
      emotion: str(),
      colors: strList(5),
      composition: str(),
      note: str(),
    })
    .catch({ text_overlay: '', faces: '', emotion: '', colors: [], composition: '', note: '' }),
  what_worked: strList(4),
  to_improve: strList(4),
  recreate: strList(4),
  packaging_score: score,
});
export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;

interface ItemRow {
  id: string;
  creator_id: string;
  platform: 'youtube' | 'instagram';
  external_id: string;
  title: string;
  description: string | null;
  url: string | null;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  comments: number | null;
  duration_seconds: number | null;
  tags_json: string | null;
  published_at: string | null;
}

const MAX_TRANSCRIPT_CHARS = 100_000;
const MAX_THUMB_BYTES = 1_500_000;

/** A compact view of a long transcript: the opening verbatim, samples from the middle, the ending */
export function transcriptDigest(segs: TranscriptSegment[], budget = 6000): string {
  if (!segs.length) return '';
  const line = (s: TranscriptSegment) => `[${formatTimestamp(s.start)}] ${s.text}`;
  const all = segs.map(line);
  if (all.join('\n').length <= budget) return all.join('\n');
  const opening = segs.filter((s) => s.start <= 90).map(line);
  const tail = segs.slice(-12).map(line);
  const middle = segs.slice(opening.length, segs.length - 12);
  const step = Math.max(1, Math.floor(middle.length / 30));
  const sampled = middle.filter((_, i) => i % step === 0).map(line);
  let out = [...opening, '…', ...sampled, '…', ...tail].join('\n');
  if (out.length > budget) out = out.slice(0, budget);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function fetchThumbnail(url: string | null): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_THUMB_BYTES) return null;
    return { bytes: buf, mimeType: res.headers.get('Content-Type') || 'image/jpeg' };
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(raw.slice(start, end + 1));
}

const ANALYSIS_SHAPE = `{"summary":"2 sentences","hook":{"text":"the opening line(s) quoted","type":"question|bold claim|result first|story|tease|other","strength":0.0-1.0,"note":"why it works or not"},
"structure":[{"at":"m:ss","label":"section"}],"topics":["..."],"tone":"...","pacing":"...","calls_to_action":["..."],"products_mentioned":["..."],"catchphrases":["short spoken phrases the creator says out of habit, quoted; not product, brand or app names"],
"title":{"pattern":"generalized with [Placeholders]","note":"..."},
"thumbnail":{"text_overlay":"exact words or none","faces":"none|creator|other","emotion":"...","colors":["..."],"composition":"...","note":"..."},
"what_worked":["..."],"to_improve":["concrete fix"],"recreate":["how to make another video like this: angle, hook, shot or format"],"packaging_score":0.0-1.0}`;

function contextLines(item: ItemRow, medianViews: number, durationSeconds: number, tags: string[]): string {
  return [
    `Title: ${item.title}`,
    item.platform === 'youtube' ? `Views: ${item.views.toLocaleString('en-US')} (channel median ${medianViews.toLocaleString('en-US')})` : '',
    item.likes ? `Likes: ${item.likes.toLocaleString('en-US')}` : '',
    durationSeconds ? `Duration: ${formatTimestamp(durationSeconds)}` : '',
    tags.length ? `Creator tags: ${tags.slice(0, 15).join(', ')}` : '',
    item.published_at ? `Published: ${item.published_at.slice(0, 10)}` : '',
    item.description ? `Description: ${item.description.replace(/\s+/g, ' ').slice(0, 600)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Breakdown built only from real data when no model is reachable */
function heuristicAnalysis(item: ItemRow, segs: TranscriptSegment[], medianViews: number): VideoAnalysis {
  const opening = segs.filter((s) => s.start <= 15).map((s) => s.text).join(' ') || item.title;
  const ratio = medianViews ? item.views / medianViews : 1;
  return VideoAnalysisSchema.parse({
    summary: item.description?.split('\n')[0]?.slice(0, 240) || item.title,
    hook: {
      text: opening.slice(0, 240),
      type: /\?/.test(opening) ? 'question' : 'statement',
      strength: Math.max(0.2, Math.min(0.9, 0.5 * ratio)),
      note: 'Taken from the first 15 seconds of the transcript',
    },
    structure: segs.length
      ? [0, 0.25, 0.5, 0.75].map((f) => {
          const s = segs[Math.floor(f * (segs.length - 1))];
          return { at: formatTimestamp(s.start), label: s.text.slice(0, 60) };
        })
      : [],
    title: {
      pattern: item.title.replace(/\d[\d,.]*/g, '[N]'),
      note: `${item.title.length} characters${/\d/.test(item.title) ? ', uses a number' : ''}${item.title.includes('?') ? ', asks a question' : ''}`,
    },
    what_worked: ratio >= 1.2 ? [`Beat the channel median by ${Math.round((ratio - 1) * 100)}%`] : [],
    to_improve: ratio < 0.8 ? ['Below the channel median; compare its title and opening with your top uploads'] : [],
    packaging_score: Math.max(0.1, Math.min(0.95, 0.5 * ratio)),
  });
}

export interface AnalyzeResult {
  status: 'done' | 'failed';
  analyzedBy?: string;
  error?: string;
}

export async function analyzeContentItem(db: D1Database, _env: Env, router: AIRouter, itemId: string): Promise<AnalyzeResult> {
  const item = await db.prepare('SELECT * FROM content_items WHERE id = ?').bind(itemId).first<ItemRow>();
  if (!item) return { status: 'failed', error: 'Content not found' };

  const creator = await db
    .prepare('SELECT content_language FROM creators WHERE id = ?')
    .bind(item.creator_id)
    .first<{ content_language: string | null }>();
  const median = await db
    .prepare(
      `SELECT views FROM content_items WHERE creator_id = ? AND platform = 'youtube' ORDER BY views LIMIT 1
       OFFSET (SELECT COUNT(*) FROM content_items WHERE creator_id = ? AND platform = 'youtube') / 2`
    )
    .bind(item.creator_id, item.creator_id)
    .first<{ views: number }>();
  const medianViews = median?.views || 0;
  const lang = /hindi|हिंदी/i.test(creator?.content_language || '') ? 'hi' : 'en';

  let segs: TranscriptSegment[] = [];
  let transcriptSource = 'none';
  let durationSeconds = item.duration_seconds || 0;
  let tags: string[] = safeArray(item.tags_json);
  let description = item.description || '';

  try {
    if (item.platform === 'youtube') {
      try {
        const details = await fetchVideoDetails(item.external_id, lang);
        durationSeconds = durationSeconds || details.durationSeconds;
        if (!tags.length) tags = details.keywords;
        if (details.description.length > description.length) description = details.description;
        if (details.captionUrl) {
          segs = await fetchTranscript(details.captionUrl);
          if (segs.length) transcriptSource = details.captionKind === 'manual' ? 'captions-manual' : 'captions-auto';
        }
      } catch (err) {
        console.warn('[analyze] video details unavailable', item.external_id, err);
      }
    } else {
      const text = item.description || item.title;
      segs = text.split(/\n+/).map((t) => ({ start: 0, text: t.trim() })).filter((s) => s.text);
      transcriptSource = 'caption-text';
    }

    const enriched = { ...item, description };
    const thumb = item.platform === 'youtube' ? await fetchThumbnail(item.thumbnail_url) : null;
    const gemini = router.getGemini();
    const workersAi = router.getWorkersAi();
    const providers = router.getAvailableProviders();

    let analysis: VideoAnalysis | null = null;
    let thumbnailNotes = '';
    let analyzedBy = 'statistics';

    // 1. Gemini watches the video and the thumbnail together
    if (gemini && item.platform === 'youtube' && item.url) {
      try {
        const raw = await gemini.analyzeYouTubeVideo(
          item.url,
          `You are studying one video from a creator's channel to learn their style. Watch it and look at the attached thumbnail.
${contextLines(enriched, medianViews, durationSeconds, tags)}
${segs.length ? '' : 'There are no captions, so also return "transcript": [{"start": seconds, "text": "..."}] with the spoken words of the first 2 minutes verbatim and one line per later section.'}
${ANALYSIS_LANGUAGE_RULE}
Return JSON only with this shape: ${ANALYSIS_SHAPE}`,
          thumb ? { mimeType: thumb.mimeType, base64: toBase64(thumb.bytes) } : undefined
        );
        const obj = parseJsonObject(raw) as Record<string, any>;
        analysis = VideoAnalysisSchema.parse(obj);
        if (!segs.length && Array.isArray(obj.transcript)) {
          segs = obj.transcript
            .map((s: any) => ({ start: Number(s.start) || 0, text: String(s.text || '').trim() }))
            .filter((s: TranscriptSegment) => s.text);
          if (segs.length) transcriptSource = 'gemini';
        }
        analyzedBy = 'gemini';
      } catch (err) {
        console.warn('[analyze] Gemini video analysis failed, falling back', err);
      }
    }

    // 2. Vision model on the thumbnail, then a language model on transcript + notes
    if (!analysis) {
      if (thumb && workersAi) {
        thumbnailNotes = await workersAi
          .describeImage(
            thumb.bytes,
            'Describe this YouTube thumbnail: the exact words of any text overlay, whether a face is shown and its emotion, the main colors, and the layout.'
          )
          .catch(() => '');
      } else if (thumb && gemini) {
        thumbnailNotes = await gemini
          .analyzeImage('Describe this YouTube thumbnail: text overlay words, face and emotion, main colors, layout. JSON.', {
            mimeType: thumb.mimeType,
            base64: toBase64(thumb.bytes),
          })
          .catch(() => '');
      }

      if (providers.claude || providers.openai || providers.workersAi || providers.gemini) {
        try {
          analysis = await router.generateStructured(
            [
              {
                role: 'system',
                content:
                  `You study one piece of a creator's content to learn their style. Quote the transcript where you can. Never invent numbers. ${ANALYSIS_LANGUAGE_RULE} Return JSON only.`,
              },
              {
                role: 'user',
                content: `${contextLines(enriched, medianViews, durationSeconds, tags)}
${thumbnailNotes ? `Thumbnail (from a vision model): ${thumbnailNotes}` : ''}
${item.platform === 'instagram' ? 'Caption' : 'Transcript'}:
${transcriptDigest(segs) || '(no transcript available; use the title and description)'}

Return JSON with this shape: ${ANALYSIS_SHAPE}`,
              },
            ],
            VideoAnalysisSchema,
            { creatorId: item.creator_id, fast: true, maxTokens: 1200, temperature: 0.3 }
          );
          analyzedBy = providers.claude ? 'claude' : providers.openai ? 'openai' : providers.workersAi ? 'workers-ai' : 'gemini';
        } catch (err) {
          console.warn('[analyze] language model failed, using statistics', err);
        }
      }
    }

    if (!analysis) analysis = heuristicAnalysis(enriched, segs, medianViews);

    const transcriptJson = JSON.stringify(segs).slice(0, MAX_TRANSCRIPT_CHARS);
    await db
      .prepare(
        `UPDATE content_items SET description = ?, duration_seconds = ?, tags_json = ?, transcript = ?, transcript_source = ?,
           thumbnail_analysis_json = ?, analysis_json = ?, analysis_status = 'done', analysis_error = NULL,
           analyzed_by = ?, analyzed_at = ?, updated_at = ? WHERE id = ?`
      )
      .bind(
        description.slice(0, 5000),
        durationSeconds || null,
        JSON.stringify(tags),
        transcriptJson.endsWith(']') ? transcriptJson : JSON.stringify(segs.slice(0, 1500)),
        transcriptSource,
        JSON.stringify({ ...analysis.thumbnail, vision_notes: thumbnailNotes || undefined }),
        JSON.stringify(analysis),
        analyzedBy,
        new Date().toISOString(),
        new Date().toISOString(),
        item.id
      )
      .run();
    return { status: 'done', analyzedBy };
  } catch (err: any) {
    const message = String(err?.message || 'Analysis failed').slice(0, 300);
    await db
      .prepare("UPDATE content_items SET analysis_status = 'failed', analysis_error = ?, updated_at = ? WHERE id = ?")
      .bind(message, new Date().toISOString(), item.id)
      .run();
    return { status: 'failed', error: message };
  }
}

/** Next items waiting for a deep study, newest first */
export async function pendingItems(db: D1Database, creatorId: string, limit: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT id FROM content_items WHERE creator_id = ? AND (analysis_status IS NULL OR analysis_status = 'pending') ORDER BY published_at DESC LIMIT ?"
    )
    .bind(creatorId, limit)
    .all<{ id: string }>();
  return (results || []).map((r) => r.id);
}

function safeArray(raw: string | null): string[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
