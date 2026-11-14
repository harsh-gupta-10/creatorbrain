import { describe, it, expect } from 'vitest';
import { parseFeed, normalizeYouTubeInput } from '../src/worker/content/youtube';
import { computeStats } from '../src/worker/agents/definitions/onboardingPipeline';
import { auditChannel } from '../src/worker/content/audit';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Maya Cooks</title>
 <entry>
  <yt:videoId>abc123</yt:videoId>
  <title>One-pan dal &amp; rice in 20 minutes</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
  <published>2026-11-10T10:00:00+00:00</published>
  <media:group>
   <media:thumbnail url="https://i1.ytimg.com/vi/abc123/hqdefault.jpg" width="480" height="360"/>
   <media:description>Weeknight dinner</media:description>
   <media:community>
    <media:starRating count="900" average="5.00" min="1" max="5"/>
    <media:statistics views="112000"/>
   </media:community>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>def456</yt:videoId>
  <title>Why is my bread dense?</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=def456"/>
  <published>2026-11-03T10:00:00+00:00</published>
  <media:group>
   <media:description></media:description>
   <media:community><media:statistics views="48000"/></media:community>
  </media:group>
 </entry>
</feed>`;

describe('YouTube channel study', () => {
  it('parses the public uploads feed', () => {
    const { title, videos } = parseFeed(FEED);
    expect(title).toBe('Maya Cooks');
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({
      id: 'abc123',
      title: 'One-pan dal & rice in 20 minutes',
      views: 112000,
      likes: 900,
      thumbnailUrl: 'https://i1.ytimg.com/vi/abc123/hqdefault.jpg',
    });
    expect(videos[1].thumbnailUrl).toContain('def456');
  });

  it('normalizes handles, URLs and channel ids', () => {
    expect(normalizeYouTubeInput('mayacooks').pageUrl).toBe('https://www.youtube.com/@mayacooks');
    expect(normalizeYouTubeInput('@mayacooks').pageUrl).toBe('https://www.youtube.com/@mayacooks');
    expect(normalizeYouTubeInput('https://www.youtube.com/@mayacooks/videos').pageUrl).toBe(
      'https://www.youtube.com/@mayacooks'
    );
    expect(normalizeYouTubeInput('https://youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ').channelId).toBe(
      'UCBJycsmduvYEL83R_U4JriQ'
    );
  });

  it('computes stats from real titles and views', () => {
    const stats = computeStats([
      { id: '1', platform: 'youtube', title: 'One-pan dal in 20 minutes', description: '', views: 112000, likes: 0, published_at: '2026-11-10T00:00:00Z' },
      { id: '2', platform: 'youtube', title: 'Why is my bread dense?', description: '', views: 48000, likes: 0, published_at: '2026-11-03T00:00:00Z' },
      { id: '3', platform: 'youtube', title: 'Dal makhani without cream', description: '', views: 52000, likes: 0, published_at: '2026-10-27T00:00:00Z' },
    ]);
    expect(stats.count).toBe(3);
    expect(stats.medianViews).toBe(52000);
    expect(stats.best[0].id).toBe('1');
    expect(stats.topWords[0]).toBe('dal');
    expect(stats.questionShare).toBeCloseTo(1 / 3);
  });
});


describe('Free channel audit', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 10, 14) - d * 86400000).toISOString();
  const channel = {
    channelId: 'UC123',
    title: 'Maya Cooks',
    url: 'https://www.youtube.com/channel/UC123',
    subscribers: 200000,
    videos: Array.from({ length: 12 }, (_, i) => ({
      id: `v${i}`,
      title: i === 3 ? 'One-pan dal in 20 minutes' : `Weeknight recipe number ${i} that everyone in my family loves to eat`,
      description: '',
      url: `https://www.youtube.com/watch?v=v${i}`,
      thumbnailUrl: '',
      views: i === 3 ? 150000 : 40000 + i * 1000,
      likes: 0,
      publishedAt: day(i * 7),
    })),
  };

  it('scores real numbers and names the top performer in a fix', () => {
    const a = auditChannel(channel, new Date(Date.UTC(2026, 10, 15)));
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.categories.map((c) => c.key)).toEqual(['consistency', 'packaging', 'reach', 'momentum']);
    expect(a.outliers[0].id).toBe('v3');
    expect(a.fixes).toHaveLength(3);
    expect(a.heatmap.reduce((n, h) => n + h.count, 0)).toBe(12);
    expect(a.stats.daysSinceLastUpload).toBe(1);
  });

  it('refuses a channel with no uploads', () => {
    expect(() => auditChannel({ ...channel, videos: [] })).toThrow();
  });
});
