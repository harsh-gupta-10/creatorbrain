// Reads a creator's public YouTube uploads without an API key.
// 1. Resolve a handle, URL or channel id to a UC… channel id from the channel page
// 2. Read the public uploads feed (latest 15 videos with views and likes)

export interface FetchedVideo {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  publishedAt: string;
}

export interface FetchedChannel {
  channelId: string;
  title: string;
  url: string;
  avatarUrl?: string;
  subscribers?: number;
  videos: FetchedVideo[];
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** The handle or link does not point at a YouTube channel we can read */
export class ChannelNotFoundError extends Error {
  readonly code = 'channel_not_found';
  constructor(input: string) {
    super(`We couldn't find a YouTube channel at "${input.slice(0, 120)}"`);
  }
}

export function normalizeYouTubeInput(input: string): { channelId?: string; pageUrl: string } {
  const raw = input.trim();
  const idMatch = raw.match(/(UC[\w-]{22})/);
  if (idMatch) return { channelId: idMatch[1], pageUrl: `https://www.youtube.com/channel/${idMatch[1]}` };

  if (/^https?:\/\//i.test(raw) || raw.includes('youtube.com')) {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const handle = url.pathname.match(/\/(@[\w.-]+)/);
    if (handle) return { pageUrl: `https://www.youtube.com/${handle[1]}` };
    return { pageUrl: `https://www.youtube.com${url.pathname.replace(/\/(videos|featured|shorts|streams)\/?$/, '')}` };
  }

  const handle = raw.startsWith('@') ? raw : `@${raw}`;
  return { pageUrl: `https://www.youtube.com/${handle.replace(/\s+/g, '')}` };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1].trim()) : undefined;
}

function attr(block: string, name: string, attribute: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*\\s${attribute}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : undefined;
}

function parseCount(text: string): number | undefined {
  const m = text.match(/([\d.,]+)\s*([KMB])?/i);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase() as 'K' | 'M' | 'B'] || 1;
  return Math.round(n * mult);
}

export function parseFeed(xml: string): { title: string; videos: FetchedVideo[] } {
  const title = tag(xml.split('<entry>')[0], 'title') || '';
  const entries = xml.split('<entry>').slice(1);
  const videos = entries.map((entry) => {
    const id = tag(entry, 'yt:videoId') || '';
    return {
      id,
      title: tag(entry, 'title') || 'Untitled',
      description: tag(entry, 'media:description') || '',
      url: attr(entry, 'link', 'href') || `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: attr(entry, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      views: Number(attr(entry, 'media:statistics', 'views') || 0),
      likes: Number(attr(entry, 'media:starRating', 'count') || 0),
      publishedAt: tag(entry, 'published') || new Date().toISOString(),
    };
  });
  return { title, videos: videos.filter((v) => v.id) };
}

// Channel pages are ~3 MB; the canonical link and header sit in the first ~1.1 MB,
// so stop reading early to stay inside the free tier CPU budget
async function readPrefix(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return out;
}

async function resolveChannel(input: string): Promise<{ channelId: string; avatarUrl?: string; subscribers?: number }> {
  const { channelId, pageUrl } = normalizeYouTubeInput(input);

  let html = '';
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1' },
    });
    if (res.ok) html = await readPrefix(res, 1_300_000);
  } catch {
    // The feed still works when we already have the id
  }

  const id =
    channelId ||
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ||
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1];

  if (!id) throw new ChannelNotFoundError(input);

  const avatarUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const subsText = html.match(/"metadataParts":\[\{"text":\{"content":"([\d.,]+[KMB]?) subscribers"/i)?.[1];
  return { channelId: id, avatarUrl, subscribers: subsText ? parseCount(subsText) : undefined };
}

export async function fetchYouTubeChannel(input: string): Promise<FetchedChannel> {
  const { channelId, avatarUrl, subscribers } = await resolveChannel(input);
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    headers: { 'User-Agent': UA },
  });
  if (res.status === 404) throw new ChannelNotFoundError(input);
  if (!res.ok) {
    throw new Error(`YouTube did not return the uploads feed (status ${res.status}). Try again in a minute`);
  }
  const { title, videos } = parseFeed(await res.text());
  return {
    channelId,
    title,
    url: `https://www.youtube.com/channel/${channelId}`,
    avatarUrl,
    subscribers,
    videos,
  };
}

// ------------------------------------------------------------------
// Full channel listing with the YouTube Data API (when YOUTUBE_API_KEY is set)
// ------------------------------------------------------------------

export interface DataApiVideo extends FetchedVideo {
  durationSeconds: number;
  tags: string[];
  comments: number;
}

export function parseIsoDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => Number(v || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/** Up to `max` most recent uploads with duration, tags and engagement. Uses 3 API calls (~3 quota units) */
export async function fetchChannelWithDataApi(input: string, apiKey: string, max = 50): Promise<FetchedChannel & { videos: DataApiVideo[] }> {
  const { channelId, pageUrl } = normalizeYouTubeInput(input);
  const base = 'https://www.googleapis.com/youtube/v3';
  const handle = pageUrl.match(/\/(@[\w.-]+)/)?.[1];
  const lookup = channelId ? `id=${channelId}` : handle ? `forHandle=${encodeURIComponent(handle)}` : '';
  if (!lookup) throw new ChannelNotFoundError(input);

  const get = async (path: string) => {
    const res = await fetch(`${base}/${path}`, { headers: { 'X-Goog-Api-Key': apiKey } });
    const data = (await res.json()) as any;
    if (!res.ok) throw new Error(data?.error?.message || `YouTube Data API returned ${res.status}`);
    return data;
  };

  const ch = (await get(`channels?part=snippet,statistics,contentDetails&${lookup}`)).items?.[0];
  if (!ch) throw new ChannelNotFoundError(input);
  const uploads = ch.contentDetails.relatedPlaylists.uploads;
  const items = (await get(`playlistItems?part=contentDetails&maxResults=${Math.min(max, 50)}&playlistId=${uploads}`)).items || [];
  const ids = items.map((i: any) => i.contentDetails.videoId).join(',');
  const vids = ids ? (await get(`videos?part=snippet,contentDetails,statistics&id=${ids}`)).items || [] : [];

  return {
    channelId: ch.id,
    title: ch.snippet.title,
    url: `https://www.youtube.com/channel/${ch.id}`,
    avatarUrl: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url,
    subscribers: ch.statistics?.hiddenSubscriberCount ? undefined : Number(ch.statistics?.subscriberCount || 0),
    videos: vids.map((v: any) => ({
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description || '',
      url: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnailUrl: (v.snippet.thumbnails?.maxres || v.snippet.thumbnails?.high || v.snippet.thumbnails?.medium)?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      comments: Number(v.statistics?.commentCount || 0),
      publishedAt: v.snippet.publishedAt,
      durationSeconds: parseIsoDuration(v.contentDetails?.duration || ''),
      tags: (v.snippet.tags || []).slice(0, 30),
    })),
  };
}

// ------------------------------------------------------------------
// Per-video details and transcript (keyless)
// ------------------------------------------------------------------

export interface TranscriptSegment {
  start: number; // seconds
  text: string;
}

export interface VideoDetails {
  durationSeconds: number;
  keywords: string[];
  description: string;
  views: number;
  captionUrl?: string;
  captionKind?: 'manual' | 'auto';
  captionLanguage?: string;
}

/** Reads duration, keywords and caption tracks from YouTube's player endpoint */
export async function fetchVideoDetails(videoId: string, preferLang = 'en'): Promise<VideoDetails> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: preferLang } },
      videoId,
    }),
  });
  if (!res.ok) throw new Error(`YouTube player returned ${res.status}`);
  const data = (await res.json()) as any;
  const vd = data.videoDetails || {};
  const tracks: any[] = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const pick =
    tracks.find((t) => t.languageCode?.startsWith(preferLang) && t.kind !== 'asr') ||
    tracks.find((t) => t.languageCode?.startsWith(preferLang)) ||
    tracks.find((t) => t.kind !== 'asr') ||
    tracks[0];
  return {
    durationSeconds: Number(vd.lengthSeconds || 0),
    keywords: (vd.keywords || []).slice(0, 30),
    description: vd.shortDescription || '',
    views: Number(vd.viewCount || 0),
    captionUrl: pick?.baseUrl,
    captionKind: pick ? (pick.kind === 'asr' ? 'auto' : 'manual') : undefined,
    captionLanguage: pick?.languageCode,
  };
}

/** Parses YouTube timedtext (srv3 `<p t="ms">` or classic `<text start="s">`) into segments */
export function parseTimedText(xml: string): TranscriptSegment[] {
  const segs: TranscriptSegment[] = [];
  const clean = (t: string) => decodeEntities(t.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  for (const m of xml.matchAll(/<p t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = clean(m[2]);
    if (text) segs.push({ start: Number(m[1]) / 1000, text });
  }
  if (segs.length) return segs;
  for (const m of xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) {
    const text = clean(m[2]);
    if (text) segs.push({ start: Number(m[1]), text });
  }
  return segs;
}

export async function fetchTranscript(captionUrl: string): Promise<TranscriptSegment[]> {
  const res = await fetch(captionUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  return parseTimedText(await res.text());
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
