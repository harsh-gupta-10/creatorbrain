import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Search, ExternalLink, Square, SquarePlay, Camera, RotateCw, Check, AlertCircle, Clock } from 'lucide-react';
import { useStudyRefresh } from '../components/StudyBanner';
import { api, type LibraryItem, type LibraryItemDetail } from '../lib/api';
import {
  PageHeader,
  EmptyState,
  ErrorNote,
  Meter,
  Segmented,
  Spinner,
  SectionTitle,
  ICON,
  formatCount,
  formatDate,
} from '../components/ui';

type Filter = 'all' | 'done' | 'pending' | 'failed';

function duration(sec?: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const SOURCE_LABEL: Record<string, string> = {
  'captions-manual': 'Creator captions',
  'captions-auto': 'Auto captions',
  gemini: 'Transcribed by Gemini',
  'caption-text': 'Post caption',
  none: 'No transcript',
};

const ENGINE_LABEL: Record<string, string> = {
  gemini: 'Gemini (watched the video)',
  claude: 'Claude',
  openai: 'OpenAI',
  'workers-ai': 'Workers AI',
  statistics: 'Transcript and view statistics',
};

export const LibraryTab: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runNote, setRunNote] = useState('');
  const stopRef = useRef(false);

  const load = async () => {
    try {
      const res = await api.content.list();
      setItems(res.items);
      setCounts(res.counts);
      setSelectedId((cur) => cur ?? res.items.find((i) => i.analysis_status === 'done')?.id ?? res.items[0]?.id ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your library');
    } finally {
      setLoading(false);
    }
  };

  useStudyRefresh(() => load());
  useEffect(() => {
    load();
    return () => {
      stopRef.current = true;
    };
  }, []);

  const waiting = counts.pending || 0;
  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.analysis_status === filter)), [items, filter]);

  // Studies waiting videos one request at a time until done or stopped
  const studyWaiting = async () => {
    setError('');
    setRunning(true);
    stopRef.current = false;
    let studied = 0;
    try {
      while (!stopRef.current) {
        const res = await api.content.analyzeNext();
        if (res.done) break;
        studied++;
        setRunNote(`Studied ${studied}, ${res.remaining} waiting`);
        await load();
        if (res.remaining === 0) break;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Study stopped');
    } finally {
      setRunning(false);
      setRunNote(studied ? `Studied ${studied} item${studied === 1 ? '' : 's'}` : '');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center text-fg-3" role="status">
        <Spinner size={20} />
        <span className="sr-only">Loading library</span>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Library"
        description="Every video and post we studied, with its transcript, thumbnail notes and breakdown. This is what your Brain learns from"
        actions={
          running ? (
            <button className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
              <Square {...ICON} />
              Stop
            </button>
          ) : (
            <button className="btn btn-primary" onClick={studyWaiting} disabled={!waiting}>
              <Play {...ICON} />
              {waiting ? `Study ${waiting} waiting` : 'All studied'}
            </button>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All ${items.length}` },
            { value: 'done', label: `Studied ${counts.done || 0}` },
            { value: 'pending', label: `Waiting ${waiting}` },
            { value: 'failed', label: `Failed ${counts.failed || 0}` },
          ]}
        />
        <span className="meta flex items-center gap-2" role="status" aria-live="polite">
          {running && <Spinner size={12} />}
          {running && !runNote && <span className="sr-only">Studying</span>}
          {runNote}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<SquarePlay {...ICON} />}
            title="Nothing studied yet"
            description="Run a channel study from the dashboard and your videos and posts will appear here"
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
          <ul className="card divide-y divide-line overflow-hidden" aria-label="Studied content">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setSelectedId(item.id)}
                  aria-current={selectedId === item.id ? 'true' : undefined}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
                    selectedId === item.id ? 'bg-raised' : 'hover:bg-raised/60'
                  }`}
                >
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt={`Thumbnail for ${item.title}`} width={88} height={50} loading="lazy" className="w-[88px] h-[50px] rounded-[6px] object-cover bg-raised shrink-0" />
                  ) : (
                    <span className="w-[88px] h-[50px] rounded-[6px] bg-raised shrink-0 flex items-center justify-center text-fg-3">
                      {item.platform === 'instagram' ? <Camera {...ICON} /> : <SquarePlay {...ICON} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] leading-5 text-fg line-clamp-2">{item.title}</span>
                    <span className="meta flex items-center gap-2 mt-1">
                      {formatDate(item.published_at)}
                      {item.duration_seconds ? <span>· {duration(item.duration_seconds)}</span> : null}
                      {item.platform === 'youtube' && <span>· {formatCount(item.views)} views</span>}
                    </span>
                  </span>
                  <StatusMark item={item} />
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="px-4 py-6 text-[13px] text-fg-2">Nothing in this view</li>}
          </ul>

          {selectedId && <Detail id={selectedId} onChanged={load} />}
        </div>
      )}
    </div>
  );
};

const StatusMark: React.FC<{ item: LibraryItem }> = ({ item }) => {
  if (item.analysis_status === 'done') {
    return <Meter value={item.packaging_score ?? 0.5} label="Packaging score" className="shrink-0" />;
  }
  if (item.analysis_status === 'failed') {
    return <AlertCircle {...ICON} className="text-negative shrink-0" aria-hidden={false} role="img" aria-label="Study failed" />;
  }
  return <Clock {...ICON} className="text-fg-3 shrink-0" aria-hidden={false} role="img" aria-label="Waiting to be studied" />;
};

const Detail: React.FC<{ id: string; onChanged: () => void }> = ({ id, onChanged }) => {
  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      setItem((await api.content.get(id)).item);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load this item');
    }
  };

  useEffect(() => {
    setItem(null);
    setQuery('');
    load();
  }, [id]);

  const restudy = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.content.analyzeNext(id);
      if (res.status === 'failed') setError(res.error || 'Study failed');
      await load();
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Study failed');
    } finally {
      setBusy(false);
    }
  };

  if (!item) {
    return (
      <div className="card p-10 flex justify-center text-fg-3" role={error ? undefined : 'status'}>
        {error ? <ErrorNote>{error}</ErrorNote> : <><Spinner size={18} /><span className="sr-only">Loading</span></>}
      </div>
    );
  }

  const a = item.analysis;
  const lines = query
    ? item.transcript.filter((s) => s.text.toLowerCase().includes(query.toLowerCase()))
    : item.transcript;
  const at = (start: number) =>
    item.platform === 'youtube' && item.url ? `${item.url}${item.url.includes('?') ? '&' : '?'}t=${Math.floor(start)}s` : undefined;

  return (
    <article className="card overflow-hidden" aria-labelledby="detail-title">
      <div className="p-5 border-b border-line flex gap-4">
        {item.thumbnail_url && (
          <img src={item.thumbnail_url} alt={`Thumbnail for ${item.title}`} width={160} height={90} className="w-[160px] h-[90px] rounded-[8px] object-cover bg-raised shrink-0 hidden sm:block" />
        )}
        <div className="min-w-0 flex-1">
          <h2 id="detail-title" className="text-[17px] leading-6 font-medium">
            {item.title}
          </h2>
          <div className="meta mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>{formatDate(item.published_at)}</span>
            {item.duration_seconds ? <span>{duration(item.duration_seconds)}</span> : null}
            {item.platform === 'youtube' && <span>{item.views.toLocaleString('en-US')} views</span>}
            {item.likes ? <span>{item.likes.toLocaleString('en-US')} likes</span> : null}
            {item.comments ? <span>{item.comments.toLocaleString('en-US')} comments</span> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <ExternalLink {...ICON} />
                Open
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={restudy} disabled={busy} aria-busy={busy}>
              {busy ? <Spinner size={14} /> : <RotateCw {...ICON} />}
              {item.analysis_status === 'done' ? 'Study again' : 'Study now'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-5 pt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {item.analysis_status === 'failed' && !error && (
        <div className="px-5 pt-4">
          <ErrorNote>{item.analysis_error || 'This item could not be studied'}</ErrorNote>
        </div>
      )}

      {!a ? (
        <EmptyState
          icon={<Clock {...ICON} />}
          title="Not studied yet"
          description="Study it now to pull its transcript, read the thumbnail and break down the hook and structure"
        />
      ) : (
        <div className="p-5 flex flex-col gap-6">
          {a.summary && <p className="text-fg-2 leading-[22px]">{a.summary}</p>}

          <section aria-labelledby="hook-h">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 id="hook-h" className="text-[13px] text-fg-3">
                Hook · {a.hook.type}
              </h3>
              <Meter value={a.hook.strength} label="Hook strength" />
            </div>
            <blockquote className="well px-4 py-3 text-fg leading-[22px]">“{a.hook.text}”</blockquote>
            {a.hook.note && <p className="mt-2 text-[13px] text-fg-2">{a.hook.note}</p>}
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section aria-labelledby="thumb-h">
              <h3 id="thumb-h" className="text-[13px] text-fg-3 mb-2">
                Thumbnail
              </h3>
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-fg-3">Text</dt>
                <dd className="text-fg">{a.thumbnail.text_overlay || 'None'}</dd>
                <dt className="text-fg-3">Face</dt>
                <dd className="text-fg">{[a.thumbnail.faces, a.thumbnail.emotion].filter(Boolean).join(', ') || 'Not seen'}</dd>
                <dt className="text-fg-3">Layout</dt>
                <dd className="text-fg">{a.thumbnail.composition || 'Not described'}</dd>
                {a.thumbnail.colors.length > 0 && (
                  <>
                    <dt className="text-fg-3">Colors</dt>
                    <dd className="flex flex-wrap gap-1">
                      {a.thumbnail.colors.map((c) => (
                        <span key={c} className="tag">
                          {/^#[0-9a-f]{3,8}$/i.test(c) && <span className="dot" aria-hidden="true" style={{ background: c }} />}
                          {c}
                        </span>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
              {a.thumbnail.note && <p className="mt-2 text-[13px] text-fg-2">{a.thumbnail.note}</p>}
            </section>

            <section aria-labelledby="title-h">
              <h3 id="title-h" className="text-[13px] text-fg-3 mb-2">
                Title and delivery
              </h3>
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-fg-3">Pattern</dt>
                <dd className="text-fg font-mono text-[12px]">{a.title.pattern || '–'}</dd>
                <dt className="text-fg-3">Tone</dt>
                <dd className="text-fg">{a.tone || '–'}</dd>
                <dt className="text-fg-3">Pacing</dt>
                <dd className="text-fg">{a.pacing || '–'}</dd>
              </dl>
              {a.title.note && <p className="mt-2 text-[13px] text-fg-2">{a.title.note}</p>}
            </section>
          </div>

          {a.structure.length > 0 && (
            <section aria-labelledby="struct-h">
              <h3 id="struct-h" className="text-[13px] text-fg-3 mb-2">
                Structure
              </h3>
              <ol className="flex flex-col">
                {a.structure.map((s, i) => (
                  <li key={i} className="flex gap-3 py-2 border-t border-line first:border-t-0 text-[14px]">
                    <span className="meta w-12 shrink-0 pt-[2px]">{s.at}</span>
                    <span className="text-fg">{s.label}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <ListBlock title="What worked" items={a.what_worked} tone="positive" />
            <ListBlock title="To improve" items={a.to_improve} tone="neutral" />
            <ListBlock title="Make another like it" items={a.recreate || []} tone="neutral" />
          </div>

          <div className="flex flex-col gap-3 text-[13px]">
            <TagRow label="Topics" values={a.topics} />
            <TagRow label="Phrases" values={a.catchphrases.map((p) => `“${p}”`)} />
            <TagRow label="Calls to action" values={a.calls_to_action} />
            <TagRow label="Products" values={a.products_mentioned} />
            <TagRow label="Your tags" values={item.tags.slice(0, 12)} />
          </div>
        </div>
      )}

      <section className="border-t border-line p-5" aria-label="Transcript">
        <SectionTitle
          title={item.platform === 'instagram' ? 'Caption' : 'Transcript'}
          meta={SOURCE_LABEL[item.transcript_source || 'none'] || item.transcript_source}
        />
        {item.transcript.length ? (
          <>
            {item.transcript.length > 8 && (
              <div className="relative mb-3">
                <Search {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
                <label htmlFor="transcript-search" className="sr-only">
                  Search transcript
                </label>
                <input
                  id="transcript-search"
                  className="input pl-9"
                  placeholder="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            <ol
              className="max-h-[360px] overflow-y-auto pr-2 flex flex-col gap-1 text-[14px] leading-[22px]"
              tabIndex={0}
              aria-label={item.platform === 'instagram' ? 'Caption lines' : 'Transcript lines'}
            >
              {lines.slice(0, 600).map((s, i) => (
                <li key={i} className="flex gap-3">
                  {item.platform === 'youtube' ? (
                    <a href={at(s.start)} target="_blank" rel="noreferrer" className="meta w-14 shrink-0 pt-[3px] hover:text-accent-ink">
                      <span className="sr-only">Play from </span>
                      {duration(Math.floor(s.start)) || '0:00'}
                      <span className="sr-only"> on YouTube (opens in a new tab)</span>
                    </a>
                  ) : null}
                  <span className="text-fg-2">{s.text}</span>
                </li>
              ))}
              {lines.length === 0 && <li className="text-[13px] text-fg-3" role="status">No lines match</li>}
            </ol>
          </>
        ) : (
          <p className="text-[13px] text-fg-2">
            {item.analysis_status === 'pending' ? 'Pulled when this item is studied' : 'This video has no captions we could read'}
          </p>
        )}
        {item.analyzed_by && (
          <p className="meta mt-4">
            Analyzed by {ENGINE_LABEL[item.analyzed_by] || item.analyzed_by}
            {item.analyzed_at ? ` · ${formatDate(item.analyzed_at)}` : ''}
          </p>
        )}
      </section>
    </article>
  );
};

const ListBlock: React.FC<{ title: string; items: string[]; tone: 'positive' | 'neutral' }> = ({ title, items, tone }) =>
  items.length ? (
    <section>
      <h3 className="text-[13px] text-fg-3 mb-2">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2 text-[14px] leading-5">
            {tone === 'positive' ? (
              <Check {...ICON} className="text-positive shrink-0 mt-[2px]" aria-hidden="true" />
            ) : (
              <span className="dot bg-fg-3 mt-2 shrink-0" aria-hidden="true" />
            )}
            <span className="text-fg">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

const TagRow: React.FC<{ label: string; values: string[] }> = ({ label, values }) =>
  values.length ? (
    <div className="flex gap-3">
      <span className="text-fg-3 w-28 shrink-0 pt-[2px]">{label}</span>
      <span className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
          </span>
        ))}
      </span>
    </div>
  ) : null;
