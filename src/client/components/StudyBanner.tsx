import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X, AlertCircle, RotateCw } from 'lucide-react';
import { api, type StudyJob } from '../lib/api';
import { navigate } from '../lib/router';
import { ICON, Spinner } from './ui';

/**
 * Runs the channel study in the background of the app and shows its progress at the
 * top of every page. Each step is one short server request, so the creator can keep
 * using the app while it works. Pages listen for `cb:study-progress` to refresh live.
 */

const START_EVENT = 'cb:study-start';
const PROGRESS_EVENT = 'cb:study-progress';
const DISMISS_KEY = 'cb:study-dismissed';
const MAX_STEP_CALLS = 60;
export const CHANNEL_EXAMPLE = 'https://www.youtube.com/@yourhandle';

/** Ask the banner to start (or resume) a study from anywhere in the app */
export function requestStudy() {
  window.dispatchEvent(new Event(START_EVENT));
}

/** Re-run `load` whenever the study makes progress (debounced) */
export function useStudyRefresh(load: () => void) {
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(() => ref.current(), 300);
    };
    window.addEventListener(PROGRESS_EVENT, handler);
    return () => {
      clearTimeout(t);
      window.removeEventListener(PROGRESS_EVENT, handler);
    };
  }, []);
}

const STEP_TEXT: Record<string, string> = {
  fetch: 'Finding your uploads',
  video: 'Studying your videos',
  synthesize: 'Learning your voice and audience',
  plan: 'Planning lessons',
};
const STEP_ORDER = ['fetch', 'video', 'synthesize', 'plan'];

interface Results {
  fetch?: string;
  channelError?: string;
  errorCode?: string;
  videoProgress?: { done: number; failed: number; last: string; total?: number };
  synthesize?: string;
  plan?: string;
}

function parseResults(job: StudyJob | null): Results {
  try {
    return JSON.parse(job?.result_json || '{}');
  } catch {
    return {};
  }
}

/** Overall progress 0..100, weighting the per-video work most */
function percent(job: StudyJob, r: Results): number {
  if (job.status === 'completed') return 100;
  const vp = r.videoProgress;
  const videoShare = vp?.total ? Math.min(1, vp.done / vp.total) : 0;
  switch (job.current_step) {
    case 'fetch':
      return 4;
    case 'video':
      return Math.round(10 + videoShare * 70);
    case 'synthesize':
      return 84;
    case 'plan':
      return 94;
    default:
      return 0;
  }
}

export const StudyBanner: React.FC<{ youtubeInput?: string | null; onChannelChanged?: () => void }> = ({
  youtubeInput,
  onChannelChanged,
}) => {
  const [job, setJob] = useState<StudyJob | null>(null);
  const [error, setError] = useState('');
  const [fixing, setFixing] = useState(false);
  const [link, setLink] = useState(youtubeInput || '');
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(() => localStorage.getItem(DISMISS_KEY));
  const running = useRef(false);
  const mounted = useRef(true);

  const drive = useCallback(async (jobId: string) => {
    if (running.current) return;
    running.current = true;
    setError('');
    try {
      for (let i = 0; i < MAX_STEP_CALLS && mounted.current; i++) {
        const res = await api.onboarding.runStep(jobId);
        if (!mounted.current) break;
        setJob(res.job);
        window.dispatchEvent(new Event(PROGRESS_EVENT));
        if (res.job.status !== 'running') break;
        if (res.busy) await new Promise((r) => setTimeout(r, 2500)); // another tab is working on it
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The study stopped');
    } finally {
      running.current = false;
    }
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      const { jobId } = await api.onboarding.startStudy();
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(null);
      setJob({ id: jobId, status: 'running', current_step: 'fetch', progress_percent: 0 });
      drive(jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start the study');
    }
  }, [drive]);

  // Resume a study that is running, or show the outcome of the latest one
  useEffect(() => {
    mounted.current = true;
    api.onboarding
      .activeStudy()
      .then(({ job: latest }) => {
        if (!mounted.current || !latest) return;
        setJob(latest);
        if (latest.status === 'running') drive(latest.id);
      })
      .catch(() => {});
    window.addEventListener(START_EVENT, start);
    return () => {
      mounted.current = false;
      window.removeEventListener(START_EVENT, start);
    };
  }, [drive, start]);

  useEffect(() => setLink(youtubeInput || ''), [youtubeInput]);

  if (!job || dismissed === job.id) return null;

  const r = parseResults(job);
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, job.id);
    setDismissed(job.id);
  };

  const saveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.onboarding.updateChannel(link.trim());
      onChannelChanged?.();
      setFixing(false);
      await start();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the link');
    } finally {
      setSaving(false);
    }
  };

  const channelMissing = job.status === 'failed' && r.errorCode === 'channel_not_found';
  const partialChannelMissing = job.status !== 'failed' && !!r.channelError;
  // ---- Channel not found (blocking, or partial once the creator asks to fix it) ----
  if (channelMissing || (partialChannelMissing && (job.status !== 'running' || fixing))) {
    return (
      <section className="border-b border-line bg-warning-soft" role="alert" aria-labelledby="study-banner-title">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle {...ICON} className="text-warning mt-[2px] shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 id="study-banner-title" className="text-[14px] font-medium text-fg">
                Your YouTube channel was not found
              </h2>
              <p className="mt-1 text-[13px] text-fg-2">
                {r.channelError || job.error_message}.{' '}
                {partialChannelMissing
                  ? 'We are studying the captions you added for now. '
                  : 'You can keep using CreatorBrain while you fix it. '}
                Open your channel on YouTube and copy the link from the address bar. It looks like{' '}
                <code className="font-mono text-fg">{CHANNEL_EXAMPLE}</code> or{' '}
                <code className="font-mono text-fg">https://www.youtube.com/channel/UC…</code>
              </p>
              <form onSubmit={saveLink} className="mt-3 flex flex-col sm:flex-row gap-2 max-w-[640px]">
                <label htmlFor="fix-channel" className="sr-only">
                  YouTube channel link
                </label>
                <input
                  id="fix-channel"
                  className="input flex-1"
                  placeholder={CHANNEL_EXAMPLE}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  autoComplete="url"
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={saving || link.trim().length < 2}>
                  {saving ? <Spinner size={14} /> : <RotateCw {...ICON} />}
                  Save and study again
                </button>
              </form>
              {error && <p className="mt-2 text-[13px] text-negative">{error}</p>}
            </div>
            <button
              className="btn btn-ghost btn-sm px-2 shrink-0"
              onClick={dismiss}
              aria-label="Dismiss channel message"
            >
              <X {...ICON} />
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ---- Running ----
  if (job.status === 'running') {
    const pct = percent(job, r);
    const vp = r.videoProgress;
    const detail =
      job.current_step === 'video' && vp?.total
        ? `${Math.min(vp.done + 1, vp.total)} of ${vp.total}${vp.last ? ` · last: ${vp.last}` : ''}`
        : '';
    return (
      <section className="border-b border-line bg-surface" aria-label="Channel study progress">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <Spinner size={14} className="text-accent shrink-0" />
            <p className="text-[13px] text-fg min-w-0 flex-1 truncate" role="status" aria-live="polite">
              <span className="font-medium">{STEP_TEXT[job.current_step] || 'Studying your channel'}</span>
              {detail && <span className="text-fg-3"> · {detail}</span>}
            </p>
            <span className="meta shrink-0">{pct}%</span>
          </div>
          <div
            className="mt-2 h-1 rounded-full bg-raised overflow-hidden"
            role="progressbar"
            aria-label="Channel study"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full bg-accent rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ol className="sr-only">
            {STEP_ORDER.map((s) => (
              <li key={s}>{STEP_TEXT[s]}</li>
            ))}
          </ol>
          {partialChannelMissing && (
            <p className="mt-2 text-[13px] text-warning">
              Your YouTube channel was not found, so we are studying your captions only.{' '}
              <button className="underline" onClick={() => setFixing(true)}>
                Fix the link
              </button>
            </p>
          )}
          {error && (
            <p className="mt-2 text-[13px] text-negative">
              {error}.{' '}
              <button className="underline" onClick={() => drive(job.id)}>
                Resume
              </button>
            </p>
          )}
        </div>
      </section>
    );
  }

  // ---- Failed for another reason ----
  if (job.status === 'failed') {
    return (
      <section className="border-b border-line bg-negative-soft" role="alert">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
          <AlertCircle {...ICON} className="text-negative shrink-0" />
          <p className="text-[13px] text-fg flex-1">
            The channel study stopped: {job.error_message || 'unknown error'}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={start}>
            <RotateCw {...ICON} />
            Try again
          </button>
          <button className="btn btn-ghost btn-sm px-2" onClick={dismiss} aria-label="Dismiss">
            <X {...ICON} />
          </button>
        </div>
      </section>
    );
  }

  // ---- Completed ----
  const vp = r.videoProgress;
  return (
    <section className="border-b border-line bg-surface" role="status">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-3">
        <Check {...ICON} className="text-positive shrink-0" />
        <p className="text-[13px] text-fg flex-1 min-w-0">
          Channel study finished
          {vp?.done ? <span className="text-fg-2"> · {vp.done} videos studied in depth</span> : null}
          {r.plan ? <span className="text-fg-2"> · {r.plan.toLowerCase()}</span> : null}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/library')}>
          Open library
        </button>
        <button className="btn btn-ghost btn-sm px-2" onClick={dismiss} aria-label="Dismiss">
          <X {...ICON} />
        </button>
      </div>
    </section>
  );
};
