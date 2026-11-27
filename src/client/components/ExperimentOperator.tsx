import { useEffect, useState } from 'react';
import { ArrowUpRight, FlaskConical, RotateCw } from 'lucide-react';
import type { ExperimentReadout, RolloutProposal } from '../../shared/studio-experiment';
import { api } from '../lib/api';
import { ErrorNote, ICON, Spinner, formatDate } from './ui';

const starterPrompts = [
  ['Review results', 'Explain the results'],
  ['Refresh results', 'Refresh the results'],
  ['Plan winner rollout', 'Roll out the winner'],
] as const;
const rate = (value: number) =>
  new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(value);

export function ExperimentOperator() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ExperimentReadout>();
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<RolloutProposal>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    void api.experiments
      .access()
      .then(({ allowed }) => {
        if (current) setAllowed(allowed);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  async function read() {
    setError('');
    setBusy(true);
    try {
      setData((await api.experiments.read()).summary);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the experiment.');
    } finally {
      setBusy(false);
    }
  }
  if (!allowed) return null;
  return (
    <details
      className="card p-4 sm:p-5 mb-8"
      onToggle={(event) => {
        if (event.currentTarget.open && !open) {
          setOpen(true);
          void read();
        }
      }}
    >
      <summary className="cursor-pointer font-medium">
        <span className="inline-flex items-center gap-2 pl-1">
          <FlaskConical {...ICON} /> Studio experiment operator
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        {!data && busy && (
          <p className="text-sm text-fg-2" role="status">
            Reading Flagsmith…
          </p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="space-y-1">
                <h3 className="font-medium">{data.name}</h3>
                <p className="text-sm text-fg-2">{data.hypothesis}</p>
                <p className="text-xs text-fg-3 capitalize">Flagsmith · {data.status}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => {
                  setPlan(undefined);
                  void read();
                }}
              >
                <RotateCw {...ICON} /> Read latest
              </button>
            </div>
            {data.asOf ? (
              <>
                <table className="w-full text-left text-sm table-fixed" aria-label="Flagsmith experiment results">
                  <thead>
                    <tr className="border-b border-line text-fg-2">
                      <th className="py-2 pr-1 font-medium">Version</th>
                      <th className="py-2 pr-1 font-medium">Exposed</th>
                      <th className="py-2 pr-1 font-medium">Sent</th>
                      <th className="py-2 font-medium">Win chance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.variants.map((item) => (
                      <tr className="border-b border-line" key={item.key}>
                        <th className="py-2 pr-1 font-medium">{item.key === 'brain' ? 'Brain' : 'General'}</th>
                        <td>{item.exposures.toLocaleString()}</td>
                        <td title={item.converters.toLocaleString() + ' creators sent a suggestion'}>
                          {item.exposures ? rate(item.converters / item.exposures) : '—'}
                        </td>
                        <td>{item.probability === null ? '—' : rate(item.probability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-fg-3">
                  Results as of {formatDate(data.asOf)}. Sent counts the share who sent a suggested prompt.
                </p>
              </>
            ) : (
              <p className="text-sm text-fg-2">Flagsmith hasn’t returned results for this metric yet.</p>
            )}
            {data.flagsmithUrl && (
              <a
                className="text-sm text-accent-ink inline-flex gap-1 items-center hover:underline"
                href={data.flagsmithUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Flagsmith experiment <ArrowUpRight {...ICON} />
              </a>
            )}
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                setPlan(undefined);
                setFeedback('');
                setError('');
                setBusy(true);
                try {
                  const result = await api.experiments.propose(prompt);
                  setData(result.summary);
                  setPlan(result.proposal);
                  setFeedback(result.message || '');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not prepare a proposal.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field-label" htmlFor="experiment-prompt">
                Ask the rollout agent
              </label>
              <div className="flex flex-wrap gap-1.5">
                {starterPrompts.map(([label, request]) => (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    key={label}
                    disabled={busy}
                    onClick={() => {
                      setPlan(undefined);
                      setPrompt(request);
                    }}
                  >
                    {label}
                  </button>
                ))}
                {data.actions.includes('pause') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setPlan(undefined);
                      setPrompt('Pause the experiment');
                    }}
                  >
                    Pause
                  </button>
                )}
                {data.actions.includes('start') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setPlan(undefined);
                      setPrompt(data.status === 'paused' ? 'Resume the experiment' : 'Start the experiment');
                    }}
                  >
                    {data.status === 'paused' ? 'Resume' : 'Start'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  id="experiment-prompt"
                  className="input min-w-32 flex-1"
                  value={prompt}
                  maxLength={800}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setPlan(undefined);
                  }}
                  placeholder="Roll out the winner"
                />
                <button className="btn btn-primary" disabled={busy || !prompt.trim()}>
                  {busy && <Spinner />} Review request
                </button>
              </div>
            </form>
          </>
        )}
        {plan && (
          <section className="rounded-lg border border-line p-4 space-y-2" aria-label="Change awaiting approval">
            <h3 className="font-medium">Awaiting approval</h3>
            <p className="text-sm">{plan.description}</p>
            {plan.reasoning && <p className="text-sm text-fg-2">{plan.reasoning}</p>}
            <p className="text-xs text-fg-3">
              Expires at {new Date(plan.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  setFeedback('');
                  try {
                    await api.experiments.approve(plan.approvalId);
                    setPlan(undefined);
                    setFeedback('Flagsmith accepted the approved change.');
                    await read();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not confirm the change.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Approve in Flagsmith
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setPlan(undefined)}>
                Discard
              </button>
            </div>
          </section>
        )}
        {feedback && (
          <p className="text-sm text-fg-2" role="status">
            {feedback}
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && error && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void read()}>
            Retry
          </button>
        )}
      </div>
    </details>
  );
}
