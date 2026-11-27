import { CompetitorWatch } from './CompetitorWatch';
import { useEffect, useState } from 'react';
import { agentKinds, type AgentConfig, type SavedAgent } from '../../shared/agents';
import { api } from '../lib/api';
import { Dialog, ErrorNote } from './ui';

const initial: AgentConfig = { name: '', kind: 'competitor', focus: '', channel: '' };

export function SavedAgents({ onRun, readOnly }: { onRun: () => void; readOnly: boolean }) {
  const [agents, setAgents] = useState<SavedAgent[]>([]);
  const [config, setConfig] = useState<AgentConfig>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [openWatch, setOpenWatch] = useState<string[]>([]);
  useEffect(() => {
    api.agents
      .list()
      .then((r) => setAgents(r.agents))
      .catch(() => setError('Could not load your agents.'));
  }, []);
  async function perform(id: string, work: () => Promise<void>) {
    setBusy(id);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="mb-8 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-medium">My agents</h2>
        <button
          className="btn btn-primary"
          hidden={readOnly}
          onClick={() => {
            setConfig(initial);
            setError('');
            setOpen(true);
          }}
        >
          Create agent
        </button>
      </div>
      {error && !open && <ErrorNote>{error}</ErrorNote>}
      {!agents.length && <p className="text-fg-2">Save a competitor to study or a writing brief to use again.</p>}
      {agents.map((a) => (
        <article className="card p-4 space-y-2" key={a.id}>
          <h3 className="font-medium">{a.name}</h3>
          <p className="meta">
            {agentKinds[a.kind]} {a.channel}
          </p>
          <p>{a.focus}</p>
          <p className="meta">In Studio or Copilot, type <code>/run {a.name}</code></p>
          {!readOnly && <div className="flex gap-2">
            <button
              disabled={!!busy}
              className="btn btn-secondary btn-sm"
              onClick={() =>
                perform(a.id, async () => {
                  const { agent } = await api.agents.run(a.id);
                  setAgents((rows) => rows.map((r) => (r.id === a.id ? agent : r)));
                  onRun();
                })
              }
            >
              {busy === a.id ? 'Running…' : 'Run agent'}
            </button>
            <button
              disabled={!!busy}
              className="btn btn-ghost btn-sm"
              onClick={() =>
                perform('remove', async () => {
                  await api.agents.remove(a.id);
                  setAgents((rows) => rows.filter((r) => r.id !== a.id));
                })
              }
            >
              Remove
            </button>
          </div>}
          {a.kind === 'competitor' && (
            <details className="border-t border-line pt-2" onToggle={(event) => {
              if (event.currentTarget.open && !openWatch.includes(a.id)) setOpenWatch((initial) => [...initial, a.id]);
            }}>
              <summary className="cursor-pointer font-medium text-sm">Competitor watchlist</summary>
              {openWatch.includes(a.id) && <CompetitorWatch agent={a} readOnly={readOnly} />}
            </details>
          )}
          {a.report && (
            <details key={a.last_run} open>
              <summary className="cursor-pointer">Latest result · {new Date(a.last_run!).toLocaleDateString()}</summary>
              <p className="whitespace-pre-wrap break-words mt-2">{a.report}</p>
            </details>
          )}
        </article>
      ))}
      {open && (
        <Dialog
          labelledBy="create-agent-title"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          className="panel w-full max-w-md p-5"
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void perform('create', async () => {
                const { agent } = await api.agents.create(config);
                setAgents((rows) => [...rows, agent]);
                setOpen(false);
              });
            }}
          >
            <h2 id="create-agent-title" className="font-medium">
              Create agent
            </h2>
            <label className="block">
              Task
              <select
                className="input"
                value={config.kind}
                onChange={(e) => setConfig({ ...config, kind: e.target.value as AgentConfig['kind'], channel: '' })}
              >
                {Object.entries(agentKinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Name
              <input
                className="input"
                required
                maxLength={80}
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
              />
            </label>
            {config.kind === 'competitor' && (
              <label className="block">
                Competitor’s YouTube channel
                <input
                  className="input"
                  required
                  maxLength={220}
                  placeholder="@channel"
                  value={config.channel}
                  onChange={(e) => setConfig({ ...config, channel: e.target.value })}
                />
              </label>
            )}
            <label className="block">
              What should it focus on?
              <textarea
                className="input"
                required
                maxLength={1200}
                value={config.focus}
                onChange={(e) => setConfig({ ...config, focus: e.target.value })}
              />
            </label>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={!!busy} className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!!busy}>
                Save agent
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
