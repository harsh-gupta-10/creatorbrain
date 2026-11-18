import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, SquarePlay } from 'lucide-react';
import { api, type ChannelAudit } from '../lib/api';
import { linkProps } from '../lib/router';
import { Logo, Spinner, ErrorNote, ICON, SkipLink, formatCount } from '../components/ui';
import type { Creator } from '../../shared/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const CHANNEL_PLACEHOLDER = 'https://www.youtube.com/@yourhandle';

/** Free channel audit, no account needed. Also embedded on the landing page */
export const AuditForm: React.FC<{
  initial?: string;
  onResult: (a: ChannelAudit | null) => void;
  compact?: boolean;
}> = ({ initial = '', onResult, compact }) => {
  const [channel, setChannel] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ran = useRef(false);

  const run = async (value: string) => {
    if (value.trim().length < 2) return setError('Paste your channel link, like https://www.youtube.com/@yourhandle');
    setLoading(true);
    setError('');
    onResult(null);
    try {
      const { audit } = await api.publicAudit(value.trim());
      onResult(audit);
      const url = new URL(window.location.href);
      if (url.pathname === '/audit') {
        url.searchParams.set('channel', value.trim());
        window.history.replaceState({}, '', url);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The audit failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial && !ran.current) {
      ran.current = true;
      run(initial);
    }
  }, [initial]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(channel);
      }}
      className={compact ? '' : 'max-w-[640px]'}
      aria-describedby="audit-hint"
    >
      <label htmlFor="audit-channel" className="field-label">
        YouTube channel
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="audit-channel"
          className="input flex-1 h-11"
          placeholder={CHANNEL_PLACEHOLDER}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          autoComplete="url"
        />
        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? <Spinner size={14} /> : null}
          {loading ? 'Auditing' : 'Audit my channel'}
        </button>
      </div>
      <p id="audit-hint" className="field-hint">
        Uses your public uploads only. No account, no card, takes a few seconds
      </p>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {loading && (
        <p className="sr-only" role="status">
          Auditing your channel
        </p>
      )}
    </form>
  );
};

export const AuditReport: React.FC<{ audit: ChannelAudit; signedIn: boolean }> = ({ audit, signedIn }) => {
  const maxCount = Math.max(1, ...audit.heatmap.map((h) => h.count));
  const best = [...audit.heatmap].filter((h) => h.count).sort((a, b) => b.medianViews - a.medianViews)[0];
  return (
    <article className="panel overflow-hidden rise-in" aria-labelledby="audit-title">
      <header className="p-5 md:p-6 border-b border-line flex flex-wrap items-center gap-4">
        {audit.channel.avatarUrl ? (
          <img
            src={audit.channel.avatarUrl}
            alt={`${audit.channel.title} channel avatar`}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover bg-raised"
          />
        ) : (
          <span className="w-12 h-12 rounded-full bg-raised flex items-center justify-center text-fg-3">
            <SquarePlay {...ICON} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="audit-title" className="text-[18px] font-medium leading-6 truncate">
            {audit.channel.title}
          </h2>
          <p className="meta mt-1">
            {audit.stats.videos} recent uploads
            {audit.channel.subscribers ? ` · ${formatCount(audit.channel.subscribers)} subscribers` : ''} · median{' '}
            {formatCount(audit.stats.medianViews)} views
          </p>
        </div>
        <div className="text-right">
          <div className="text-[40px] leading-none font-medium num" aria-label={`Score ${audit.score} out of 100`}>
            {audit.score}
            <span className="text-[16px] text-fg-3"> / 100</span>
          </div>
          <div className="meta mt-1">Channel score</div>
        </div>
      </header>

      <div className="grid md:grid-cols-2">
        <section className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-line" aria-labelledby="audit-cats">
          <h3 id="audit-cats" className="text-[13px] text-fg-3 mb-4">
            Breakdown
          </h3>
          <ul className="flex flex-col gap-4">
            {audit.categories.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium">{c.label}</span>
                  <span className="meta">{c.score}</span>
                </div>
                <div
                  className="mt-2 h-[6px] rounded-full bg-raised overflow-hidden"
                  role="meter"
                  aria-label={c.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={c.score}
                >
                  <div
                    className={`h-full rounded-full ${c.score < 55 ? 'bg-accent' : 'bg-fg-3/60'}`}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <p className="mt-1 text-[13px] text-fg-2">{c.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-5 md:p-6" aria-labelledby="audit-heat">
          <h3 id="audit-heat" className="text-[13px] text-fg-3 mb-4">
            When you post
          </h3>
          <div
            className="grid grid-cols-7 gap-2"
            role="img"
            aria-label={audit.heatmap.map((h) => `${WEEKDAYS_LONG[h.weekday]}: ${h.count} uploads`).join(', ')}
          >
            {audit.heatmap.map((h) => {
              const isBest = best?.weekday === h.weekday;
              const shade = h.count ? 0.15 + (h.count / maxCount) * 0.6 : 0;
              return (
                <div key={h.weekday} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-full aspect-square rounded-[6px] ${isBest ? 'bg-accent' : ''}`}
                    style={
                      isBest ? undefined : { background: h.count ? `rgb(23 23 23 / ${shade})` : 'var(--color-raised)' }
                    }
                  />
                  <span className="meta">{WEEKDAYS[h.weekday]}</span>
                  <span className="meta">{h.count}</span>
                </div>
              );
            })}
          </div>
          {best && (
            <p className="mt-4 text-[13px] text-fg-2">
              {WEEKDAYS_LONG[best.weekday]} uploads have your best median, {formatCount(best.medianViews)} views
            </p>
          )}

          <h3 className="text-[13px] text-fg-3 mt-6 mb-3">Top uploads</h3>
          <ul className="flex flex-col gap-3">
            {audit.outliers.map((o) => (
              <li key={o.id}>
                <a href={o.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                  <img
                    src={o.thumbnailUrl}
                    alt={`Thumbnail for ${o.title}`}
                    width={72}
                    height={40}
                    loading="lazy"
                    className="w-[72px] h-[40px] rounded-[6px] object-cover bg-raised shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-5 truncate group-hover:text-accent-ink transition-colors">
                      {o.title}
                    </span>
                    <span className="meta">
                      {formatCount(o.views)} views · {o.ratio}x median
                    </span>
                  </span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="p-5 md:p-6 border-t border-line" aria-labelledby="audit-fixes">
        <h3 id="audit-fixes" className="text-[13px] text-fg-3 mb-4">
          Three fixes to try next
        </h3>
        <ol className="grid gap-4 md:grid-cols-3">
          {audit.fixes.map((f, i) => (
            <li key={f.title} className="well p-4">
              <span className="meta">{String(i + 1).padStart(2, '0')}</span>
              <div className="mt-2 font-medium leading-5">{f.title}</div>
              <p className="mt-2 text-[13px] text-fg-2 leading-5">{f.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="p-5 md:p-6 border-t border-line bg-raised/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-[14px] text-fg-2 max-w-[520px]">
          This audit reads titles, dates and views. With an account, CreatorBrain also studies every video's transcript
          and thumbnail and drafts your next one in your voice
        </p>
        <a {...linkProps(signedIn ? '/app' : '/signup')} className="btn btn-primary shrink-0">
          {signedIn ? 'Open your workspace' : 'Study my channel in depth'}
          <ArrowRight {...ICON} />
        </a>
      </footer>
    </article>
  );
};

export const AuditPage: React.FC<{ session: { creator: Creator | null; isSample: boolean } }> = ({ session }) => {
  const [audit, setAudit] = useState<ChannelAudit | null>(null);
  const initial = new URLSearchParams(window.location.search).get('channel') || '';
  const signedIn = !!session.creator && !session.isSample;

  useEffect(() => {
    document.title = audit
      ? `${audit.channel.title} audit · CreatorBrain`
      : 'Free YouTube channel audit · CreatorBrain';
  }, [audit]);

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <SkipLink />
      <header className="border-b border-line">
        <div className="max-w-[1100px] mx-auto h-16 px-5 md:px-8 flex items-center justify-between">
          <a {...linkProps('/')} aria-label="CreatorBrain home">
            <Logo />
          </a>
          <nav aria-label="Account" className="flex items-center gap-4">
            {signedIn ? (
              <a {...linkProps('/app')} className="btn btn-primary btn-sm">
                Open workspace
              </a>
            ) : (
              <>
                <a {...linkProps('/login')} className="text-[14px] text-fg-2 hover:text-fg transition-colors">
                  Sign in
                </a>
                <a {...linkProps('/signup')} className="btn btn-primary btn-sm">
                  Create account
                </a>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="outline-none max-w-[1100px] mx-auto px-5 md:px-8 py-12 md:py-16">
        <h1 className="text-[32px] leading-[40px] md:text-[44px] md:leading-[52px] font-medium tracking-[-0.02em] max-w-[720px]">
          Free YouTube channel audit
        </h1>
        <p className="mt-3 text-[17px] leading-[26px] text-fg-2 max-w-[600px]">
          A score for consistency, titles, reach and momentum, when you post, your top uploads and three fixes to try
          next
        </p>
        <div className="mt-8">
          <AuditForm initial={initial} onResult={setAudit} />
        </div>
        <div className="mt-10" aria-live="polite">
          {audit && <AuditReport audit={audit} signedIn={signedIn} />}
        </div>
      </main>
    </div>
  );
};
