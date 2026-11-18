import { describe, it, expect } from 'vitest';
import { parseTimedText, parseIsoDuration, formatTimestamp } from '../src/worker/content/youtube';
import { VideoAnalysisSchema, transcriptDigest } from '../src/worker/content/analyze';

describe('Transcripts', () => {
  it('parses srv3 timed text with entities and line breaks', () => {
    const xml = `<?xml version="1.0"?><timedtext format="3"><body>
      <p t="3010" d="1263">It&#39;s a MacBook Pro...</p>
      <p t="6461" d="2285">with a touchscreen.
But</p>
      <p t="9000" d="100"></p>
    </body></timedtext>`;
    expect(parseTimedText(xml)).toEqual([
      { start: 3.01, text: "It's a MacBook Pro..." },
      { start: 6.461, text: 'with a touchscreen. But' },
    ]);
  });

  it('parses classic timed text', () => {
    const xml = '<transcript><text start="1.5" dur="2">Hello &amp; welcome</text></transcript>';
    expect(parseTimedText(xml)).toEqual([{ start: 1.5, text: 'Hello & welcome' }]);
  });

  it('keeps the opening verbatim and samples long transcripts within budget', () => {
    const segs = Array.from({ length: 2000 }, (_, i) => ({ start: i * 2, text: `line ${i} of the talk` }));
    const digest = transcriptDigest(segs, 6000);
    expect(digest.length).toBeLessThanOrEqual(6000);
    expect(digest.startsWith('[0:00] line 0 of the talk')).toBe(true);
    expect(digest).toContain('[1:30]');
  });

  it('formats durations', () => {
    expect(parseIsoDuration('PT15M13S')).toBe(913);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(formatTimestamp(913)).toBe('15:13');
    expect(formatTimestamp(3723)).toBe('1:02:03');
  });
});

describe('Per-video analysis schema', () => {
  it('fills missing fields without inventing text', () => {
    const a = VideoAnalysisSchema.parse({
      summary: 'Two sentences.',
      hook: { text: 'Look at this' },
      topics: ['phones', null, ''],
    });
    expect(a.hook.type).toBe('Unclassified');
    expect(a.hook.note).toBe('');
    expect(a.thumbnail.note).toBe('');
    expect(a.topics).toEqual(['phones']);
    expect(a.packaging_score).toBe(0.5);
    expect(JSON.stringify(a)).not.toContain('undefined');
  });

  it('clamps scores and caps lists', () => {
    const a = VideoAnalysisSchema.parse({ packaging_score: 7, topics: Array.from({ length: 20 }, (_, i) => `t${i}`) });
    expect(a.packaging_score).toBe(0.5);
    expect(a.topics).toHaveLength(8);
  });
});
