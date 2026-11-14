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

  if (!id) {
    throw new Error('We could not find that YouTube channel. Check the handle or paste the channel URL');
  }

  const avatarUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  const subsText = html.match(/"metadataParts":\[\{"text":\{"content":"([\d.,]+[KMB]?) subscribers"/i)?.[1];
  return { channelId: id, avatarUrl, subscribers: subsText ? parseCount(subsText) : undefined };
}

export async function fetchYouTubeChannel(input: string): Promise<FetchedChannel> {
  const { channelId, avatarUrl, subscribers } = await resolveChannel(input);
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    headers: { 'User-Agent': UA },
  });
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
