import { useEffect, useState } from 'react';
import type { WatchReview } from '../../shared/creator-workflows';
import type { SavedAgent } from '../../shared/agents';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { ErrorNote, Spinner, formatDate } from './ui';

export function CompetitorWatch({ agent, readOnly }: { agent: SavedAgent; readOnly: boolean }) {
  const [review, setReview] = useState<WatchReview | null>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let active = true;
    void api.agents
      .watch(agent.id)
      .then(({ review }) => {
        if (active) setReview(review);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [agent.id, agent.last_run]);
  const current = review?.current;
  async function makeBrief(title: string, url: string) {
    setBusy(url);
    setError('');
    try {
      const { project } = await api.studio.createProject({
        title: ('Follow-up idea: ' + title).slice(0, 160),
        brief: `Reference: ${title}\n${url}\n\nPlan an original video for my audience. My focus: ${agent.focus}`,
      });
      navigate('/app/studio?' + new URLSearchParams({ project: project.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a Studio project.');
    } finally {
      setBusy('');
    }
  }
  const uploadRow = (title: string, url: string, note: string) => (
    <li key={url} className="py-2 flex items-start flex-wrap gap-2">
      <div className="flex-1 min-w-36 break-words">
        <a className="text-sm text-accent-ink hover:underline" href={url} rel="noreferrer" target="_blank">
          {title}
        </a>
        <p className="meta">{note}</p>
      </div>
      {!readOnly && (
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          disabled={!!busy}
          aria-label={'Make Studio brief for ' + title}
          onClick={() => void makeBrief(title, url)}
        >
          Make Studio brief
        </button>
      )}
    </li>
  );
  return (
    <div className="space-y-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-2">
          {current
            ? `Checked ${formatDate(current.checkedAt)}`
            : 'Check the channel to establish a baseline for future updates.'}
        </p>
        {!readOnly && (
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy('check');
              setError('');
              try {
                setReview((await api.agents.watch(agent.id, true)).review);
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Could not check the channel.');
              } finally {
                setBusy('');
              }
            }}
          >
            {busy === 'check' && <Spinner />} Check uploads
          </button>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {current && review && (
        <>
          {review.previousCheckedAt && (
            <p className="text-sm font-medium">
              {review.newUploads.length
                ? `${review.newUploads.length} new in the latest uploads since ${formatDate(review.previousCheckedAt)}`
                : 'No new uploads detected since the previous check.'}
            </p>
          )}
          <ul className="divide-y divide-line">
            {(review.previousCheckedAt ? review.newUploads : current.uploads.slice(0, 5)).map((video) =>
              uploadRow(
                video.title,
                video.url,
                video.views ? video.views.toLocaleString() + ' recorded views' : 'View count unavailable'
              )
            )}
          </ul>
          {current.outliers.length > 0 && (
            <>
              <p className="text-sm font-medium">Above the channel’s median views</p>
              <ul className="divide-y divide-line">
                {current.outliers.map((video) =>
                  uploadRow(video.title, video.url, video.ratio.toFixed(1) + '× the median in this sample')
                )}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
