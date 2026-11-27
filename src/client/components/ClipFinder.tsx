import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { ClipMatch } from '../../shared/creator-workflows';
import { api } from '../lib/api';
import { ErrorNote, ICON, Spinner } from './ui';

export function ClipFinder({ topic = '' }: { topic?: string }) {
  const [query, setQuery] = useState(topic);
  const [result, setResult] = useState<ClipMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          setBusy(true);
          try {
            setResult((await api.workflows.clips(query)).clips);
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not search captions.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="sr-only" htmlFor="clip-query">
          Caption search
        </label>
        <input
          id="clip-query"
          className="input flex-1 min-w-40"
          placeholder="Try Arduino, battery life, or first impressions"
          value={query}
          maxLength={240}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner /> : <Search {...ICON} />} Find clips
        </button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {result?.length === 0 && (
        <p className="text-sm text-fg-2">
          No matching timestamps in your recent YouTube captions. Try a shorter phrase or study a video that has
          captions.
        </p>
      )}
      {result && result.length > 0 && (
        <ol className="divide-y divide-line border-y border-line">
          {result.map((clip) => (
            <li key={clip.url} className="py-3.5 space-y-2">
              <a
                className="inline-flex gap-2 items-baseline text-sm font-medium text-accent-ink hover:underline"
                href={clip.url}
                target="_blank"
                rel="noreferrer"
              >
                {Math.floor(clip.start / 60)}:{String(clip.start % 60).padStart(2, '0')} · {clip.title}
                <ExternalLink className="shrink-0" {...ICON} />
              </a>
              <blockquote className="border-l-2 border-line pl-3 text-sm text-fg-2">{clip.excerpt}</blockquote>
              <p className="text-sm">
                <span className="font-medium">Suggested opening</span> “{clip.opening}”
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
