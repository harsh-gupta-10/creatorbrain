import React, { useEffect, useState } from 'react';
import { Bot, Play, Terminal, Check } from 'lucide-react';
import { api } from '../lib/api';
import type { AgentTrace } from '../../shared/types';
import { PageHeader, SectionTitle, EmptyState, ErrorNote, Spinner, ICON } from '../components/ui';

export const AgentsTab: React.FC = () => {
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTraces();
  }, []);

  const loadTraces = async () => {
    setLoading(true);
    try {
      const res = await api.agents.getTraces();
      setTraces(res.traces || []);
    } catch (err: unknown) {
      console.error('Failed to load agent traces:', err);
      setError(err instanceof Error ? err.message : 'Could not load agent traces');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgentsNow = async () => {
    setIsRunningAgents(true);
    setRunMessage(null);
    setError(null);
    try {
      const res = await api.agents.runNow();
      setTraces(res.traces || []);
      setRunMessage(`Run finished. Next best action: ${res.nextBestAction}`);
      setTimeout(() => setRunMessage(null), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The agent run failed');
    } finally {
      setIsRunningAgents(false);
    }
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Agents"
        description="Step-by-step traces of each agent run: what it read, which tool it called and what it returned"
        actions={
          <button onClick={handleRunAgentsNow} disabled={isRunningAgents} aria-busy={isRunningAgents} className="btn btn-primary">
            {isRunningAgents ? <Spinner /> : <Play {...ICON} />}
            {isRunningAgents ? 'Running' : 'Run agents now'}
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div role="status">
        {runMessage && (
          <div className="mb-4 card px-4 py-3 flex items-center gap-2 text-[13px] text-fg">
            <Check {...ICON} className="text-positive shrink-0" />
            {runMessage}
          </div>
        )}
      </div>

      <SectionTitle title="Recent traces" meta={traces.length} action={<span className="meta">Up to 6 steps per run</span>} />

      {loading && traces.length === 0 ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-fg-3" role="status">
          <Spinner /> <span className="text-[13px]">Loading traces</span>
        </div>
      ) : traces.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Bot {...ICON} />}
            title="No agent runs yet"
            description="Run the agents to see each step they take on your content"
          />
        </div>
      ) : (
        <ol className="relative ml-2 border-l border-line space-y-4">
          {traces.map((trace) => (
            <li key={trace.id} className="relative pl-6">
              <span
                className={`absolute -left-1 top-5 w-2 h-2 rounded-full ring-4 ring-page ${
                  trace.status === 'success'
                    ? 'bg-positive'
                    : trace.status === 'running'
                    ? 'bg-accent'
                    : 'bg-negative'
                }`}
                aria-hidden="true"
              />

              <div className="card p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <h3 className="font-medium text-fg truncate">{trace.agent_name}</h3>
                    <span className="sr-only">Status: {trace.status}.</span>
                    <span className="meta">
                      Step {trace.step_number} of {trace.total_steps}
                    </span>
                  </div>
                  <span className="meta">{new Date(trace.created_at).toLocaleString()}</span>
                </div>

                <p className="text-fg-2">{trace.output_summary}</p>

                {trace.tool_called && (
                  <div className="well p-3 font-mono text-[12px] leading-4 space-y-1">
                    <div className="flex items-center gap-2 text-fg">
                      <Terminal {...ICON} className="text-fg-3" /> {trace.tool_called}
                    </div>
                    {trace.tool_input && <p className="text-fg-3 truncate">Input: {trace.tool_input}</p>}
                    {trace.tool_result && <p className="text-fg-2 truncate">Result: {trace.tool_result}</p>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
