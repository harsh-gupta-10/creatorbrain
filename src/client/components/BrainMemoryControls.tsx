import { useEffect, useState } from 'react';
import type { BrainControl, BrainFinding } from '../../shared/creator-workflows';
import { api } from '../lib/api';
import { useStudyRefresh } from './StudyBanner';
import { ErrorNote, SectionTitle, Spinner } from './ui';

const stateLabels = {
  pinned: 'Pinned',
  dismissed: 'Dismissed',
  corrected: 'Corrected',
  preference: 'Preference',
} as const;

export function BrainMemoryControls({ readOnly, onChange }: { readOnly: boolean; onChange: () => void }) {
  const [data, setData] = useState<{ findings: BrainFinding[]; controls: BrainControl[] }>();
  const [preference, setPreference] = useState('');
  const [editing, setEditing] = useState<{ id: string; note: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useStudyRefresh(() => {
    void reload();
  });
  async function reload() {
    try {
      setData(await api.workflows.memory());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load Brain memory.');
    }
  }
  useEffect(() => {
    let active = true;
    void api.workflows
      .memory()
      .then((data) => {
        if (active) setData(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function change(save: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await save();
      await reload();
      onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save Brain memory.');
    } finally {
      setBusy(false);
    }
  }
  const controlByKey = new Map(data?.controls.map((item) => [item.key, item]));
  const visible = new Set(data?.findings.map(({ key }) => key));
  const saved = data?.controls.filter((control) => !visible.has(control.key)) || [];
  return (
    <section aria-label="Brain memory controls" className="space-y-3">
      <SectionTitle title="Memory and preferences" />
      <div className="card p-4 sm:p-5 space-y-4">
        {!readOnly && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void change(async () => {
                await api.workflows.setMemory('preference', undefined, preference);
                setPreference('');
              });
            }}
          >
            <label htmlFor="brain-preference" className="field-label">
              Tell Brain what to remember
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                className="input min-w-40 flex-1"
                id="brain-preference"
                value={preference}
                maxLength={320}
                required
                onChange={(event) => setPreference(event.target.value)}
                placeholder="Write my Shorts in Roman Hindi"
              />
              <button className="btn btn-primary" disabled={busy || !preference.trim()}>
                {busy && <Spinner />} Save preference
              </button>
            </div>
          </form>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        {!data && !error && (
          <p className="text-sm text-fg-2" role="status">
            Loading saved memory…
          </p>
        )}
        {saved.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {saved.map((item) => (
              <li key={item.key} className="py-2.5 flex items-start flex-wrap justify-between gap-2">
                <div className="text-sm break-words flex-1 min-w-36">
                  <span className="meta">{stateLabels[item.state]}</span>
                  <p>{item.note || item.label}</p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    aria-label={'Remove ' + (item.note || item.label)}
                    onClick={() => void change(() => api.workflows.resetMemory(item.key))}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {data?.findings.length === 0 && (
          <p className="text-sm text-fg-2">Study a YouTube channel to get findings you can pin, correct, or dismiss.</p>
        )}
        {data && data.findings.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Review Brain findings</summary>
            <ul className="divide-y divide-line mt-2">
              {data.findings.map((finding) => {
                const control = controlByKey.get(finding.key);
                return (
                  <li key={finding.key} className="py-3 space-y-2 text-sm">
                    <p className="font-medium">{control?.state === 'corrected' ? control.note : finding.label}</p>
                    <p className="text-xs text-fg-3">
                      {finding.type}
                      {control && ' · ' + stateLabels[control.state]}
                    </p>
                    {finding.description && !control?.note && <p className="text-fg-2">{finding.description}</p>}
                    {finding.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-accent-ink hover:underline"
                      >
                        {source.title}
                      </a>
                    ))}
                    {!readOnly && (
                      <div className="flex flex-wrap gap-1">
                        {control?.state !== 'pinned' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => void change(() => api.workflows.setMemory('pinned', finding.id))}
                          >
                            Pin
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => setEditing({ id: finding.id, note: control?.note || finding.label })}
                        >
                          Correct
                        </button>
                        {control?.state !== 'dismissed' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => void change(() => api.workflows.setMemory('dismissed', finding.id))}
                          >
                            Dismiss
                          </button>
                        )}
                        {control && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => void change(() => api.workflows.resetMemory(control.key))}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                    {editing?.id === finding.id && (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void change(async () => {
                            await api.workflows.setMemory('corrected', finding.id, editing.note);
                            setEditing(undefined);
                          });
                        }}
                      >
                        <input
                          className="input flex-1 min-w-36"
                          aria-label="Corrected finding"
                          value={editing.note}
                          maxLength={320}
                          required
                          onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                        />
                        <button className="btn btn-primary btn-sm" disabled={busy || !editing.note.trim()}>
                          Save correction
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(undefined)}>
                          Cancel
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
