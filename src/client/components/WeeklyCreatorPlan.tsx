import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { PlanAction } from '../../shared/creator-workflows';
import { api } from '../lib/api';
import { linkProps } from '../lib/router';
import { useStudyRefresh } from './StudyBanner';
import { ErrorNote, ICON, SectionTitle } from './ui';

export function WeeklyCreatorPlan({ readOnly }: { readOnly: boolean }) {
  const [actions, setActions] = useState<PlanAction[]>();
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  useStudyRefresh(() => {
    void api.workflows
      .plan()
      .then(({ actions }) => setActions(actions))
      .catch(() => {});
  });
  useEffect(() => {
    let active = true;
    void api.workflows
      .plan()
      .then(({ actions }) => {
        if (active) setActions(actions);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="mt-7 mb-6" aria-label="This week's plan">
      <SectionTitle title="This week’s plan" />
      <div className="card">
        {error && (
          <div className="p-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        {!actions && !error && (
          <p className="px-4 py-3 text-sm text-fg-2" role="status">
            Checking projects and deadlines…
          </p>
        )}
        {actions?.length === 0 && (
          <p className="px-4 py-3 text-sm text-fg-2">
            You’re caught up. New actions appear as you work on projects and deals.
          </p>
        )}
        {!!actions?.length && (
          <ol className="divide-y divide-line">
            {actions.map((action) => {
              const query = action.projectId
                ? '?' +
                  new URLSearchParams({
                    project: action.projectId,
                    ...(action.id.startsWith('review:') ? { tools: 'publication' } : {}),
                  })
                : '';
              return (
                <li className="px-4 py-3 flex flex-wrap items-center gap-2" key={action.id}>
                  <div className="min-w-0 flex-1 basis-40">
                    <a
                      className="font-medium text-sm hover:underline inline-flex items-center gap-1"
                      {...linkProps('/app/' + action.tab + query)}
                    >
                      {action.title}
                      <ArrowUpRight {...ICON} className="shrink-0" />
                    </a>
                    <p className="text-sm text-fg-2 mt-1">{action.reason}</p>
                  </div>
                  {!readOnly && (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={!!pending}
                      onClick={async () => {
                        setPending(action.id);
                        setError('');
                        try {
                          setActions((await api.workflows.snooze(action.id)).actions);
                        } catch (error) {
                          setError(error instanceof Error ? error.message : 'Could not snooze that action.');
                        } finally {
                          setPending('');
                        }
                      }}
                      aria-label={'Snooze ' + action.title}
                    >
                      {pending === action.id ? 'Snoozing…' : 'Snooze 7 days'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
