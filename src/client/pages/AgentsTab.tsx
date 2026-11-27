import { SavedAgents } from '../components/SavedAgents';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Check, ChevronDown, Clock3, FileText, Lightbulb, Play, Terminal } from 'lucide-react';
import { api } from '../lib/api';
import type { AgentTrace } from '../../shared/types';
import { EmptyState, ErrorNote, ICON, PageHeader, SectionTitle, Spinner } from '../components/ui';

interface TraceGroup {
  latest: AgentTrace;
  repeats: AgentTrace[];
}

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const redactPrivateFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactPrivateFields);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(creator|user|account)?_?id|password|secret|token|email/i.test(key))
      .map(([key, nested]) => [key, redactPrivateFields(nested)])
  );
};

const readableJson = (raw?: string) => {
  if (!raw) return 'No details were recorded for this step.';
  try {
    return JSON.stringify(redactPrivateFields(JSON.parse(raw)), null, 2);
  } catch {
    return raw;
  }
};

const getResult = (trace: AgentTrace): Record<string, unknown> | null => {
  if (!trace.tool_result) return null;
  try {
    const value: unknown = JSON.parse(trace.tool_result);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const nextActionOf = (trace: AgentTrace) => {
  const result = getResult(trace);
  const action = result?.nextBestAction || result?.next_best_action;
  if (typeof action === 'string' && action.trim()) return action.trim();
  const match = trace.output_summary.match(/next best action:\s*["“](.+?)["”](?:\.|$)/i);
  return match?.[1]?.trim() || '';
};

const groupRepeatedTraces = (traces: AgentTrace[]): TraceGroup[] => {
  const groups = new Map<string, TraceGroup>();
  for (const trace of [...traces].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const fingerprint = [
      trace.agent_name,
      trace.status,
      trace.tool_called,
      trace.task_description,
      trace.output_summary,
      trace.tool_result,
    ]
      .map((part) => part || '')
      .join('\u001f');
    const existing = groups.get(fingerprint);
    if (existing) existing.repeats.push(trace);
    else groups.set(fingerprint, { latest: trace, repeats: [] });
  }
  return [...groups.values()];
};

const toolLabel = (tool?: string) => {
  if (!tool) return 'Agent step';
  const known: Record<string, string> = {
    evaluateChannelHealth: 'Reviewed channel signals',
    recordLearning: 'Saved a channel learning',
    searchContent: 'Searched your content',
  };
  return known[tool] || tool.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
};

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
    setError(null);
    try {
      const res = await api.agents.getTraces();
      setTraces(res.traces || []);
    } catch (err: unknown) {
      console.error('Failed to load agent traces:', err);
      setError(err instanceof Error ? err.message : 'Could not load agent activity');
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
      setRunMessage('Your channel insights are up to date.');
      window.setTimeout(() => setRunMessage(null), 6000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update channel insights');
    } finally {
      setIsRunningAgents(false);
    }
  };

  const groupedTraces = groupRepeatedTraces(traces);
  const recommendationTrace = traces.find((trace) => trace.status === 'success' && nextActionOf(trace));
  const recommendation = recommendationTrace ? nextActionOf(recommendationTrace) : '';
  const latestSuccess = traces.find((trace) => trace.status === 'success');
  const runStatus = latestSuccess ? formatDate(latestSuccess.created_at) : null;

  return (
    <div className="w-full">
      <PageHeader
        title="Agent activity"
        description="See what CreatorBrain checked, what it learned, and the next step it recommends. You decide what to do."
        actions={
          <button
            type="button"
            onClick={handleRunAgentsNow}
            disabled={isRunningAgents}
            aria-busy={isRunningAgents}
            className="btn btn-primary"
          >
            {isRunningAgents ? <Spinner /> : <Play {...ICON} />}
            {isRunningAgents ? 'Updating insights' : 'Update my insights'}
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div role="status" aria-live="polite">
        {runMessage && (
          <div className="mb-4 card px-4 py-3 flex items-center gap-2 text-[13px] text-fg">
            <Check {...ICON} className="text-positive shrink-0" />
            {runMessage}
          </div>
        )}
      </div>

      <SavedAgents onRun={loadTraces} />

      {recommendation && (
        <section className="card p-5 md:p-6 mb-8" aria-labelledby="next-action-title">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent-ink flex items-center justify-center shrink-0">
              <Lightbulb {...ICON} />
            </span>
            <div className="min-w-0">
              <h2 id="next-action-title" className="text-[15px] font-medium text-fg">
                Recommended next step
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-fg">{recommendation}</p>
              {runStatus && (
                <p className="mt-3 flex items-center gap-2 meta">
                  <Clock3 {...ICON} /> Based on your latest agent run · {runStatus}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <SectionTitle
        title="Recent activity"
        meta={groupedTraces.length}
        action={<span className="meta">Repeated identical results are grouped together</span>}
      />

      {loading && traces.length === 0 ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-fg-3" role="status">
          <Spinner /> <span className="text-[13px]">Loading agent activity</span>
        </div>
      ) : groupedTraces.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Bot {...ICON} />}
            title="No channel review yet"
            description="Update your insights to have CreatorBrain review your channel signals and suggest one useful next step."
          />
        </div>
      ) : (
        <ol className="relative ml-2 border-l border-line space-y-4">
          {groupedTraces.map(({ latest: trace, repeats }) => {
            const result = getResult(trace);
            const agents = Array.isArray(result?.recommendedAgents)
              ? result.recommendedAgents.filter((item): item is string => typeof item === 'string')
              : [];
            const isFailed = trace.status === 'failed';
            const statusLabel = isFailed ? 'Needs attention' : trace.status === 'running' ? 'In progress' : 'Complete';

            return (
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
                <article className="card p-4 md:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <h3 className="font-medium text-fg truncate">{trace.agent_name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                          isFailed ? 'bg-negative-soft text-negative' : 'bg-positive-soft text-positive'
                        }`}
                      >
                        {isFailed ? <AlertTriangle {...ICON} /> : <Check {...ICON} />}
                        {statusLabel}
                      </span>
                    </div>
                    <time className="meta shrink-0" dateTime={trace.created_at}>
                      {formatDate(trace.created_at)}
                    </time>
                  </div>

                  <p className="text-[14px] leading-5 text-fg-2">{trace.output_summary || trace.task_description}</p>

                  {agents.length > 0 && <p className="text-[12px] text-fg-3">Related areas: {agents.join(', ')}</p>}

                  {repeats.length > 0 && (
                    <details className="group border-t border-line pt-3">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] text-fg-2">
                        <ChevronDown {...ICON} className="transition-transform group-open:rotate-180" />
                        Same result recorded {repeats.length} more {repeats.length === 1 ? 'time' : 'times'}
                      </summary>
                      <ul className="mt-3 space-y-2 pl-6">
                        {repeats.map((repeat) => (
                          <li key={repeat.id} className="meta">
                            {formatDate(repeat.created_at)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {(trace.tool_called || trace.tool_input || trace.tool_result) && (
                    <details className="group border-t border-line pt-3">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] text-fg-2">
                        <ChevronDown {...ICON} className="transition-transform group-open:rotate-180" />
                        <FileText {...ICON} />
                        How this result was produced
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="well p-3">
                          <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
                            <Terminal {...ICON} /> {toolLabel(trace.tool_called)}
                          </p>
                          {trace.task_description && (
                            <p className="mt-2 text-[13px] text-fg-2">{trace.task_description}</p>
                          )}
                        </div>
                        {trace.tool_input && (
                          <div>
                            <p className="meta mb-1">Context provided</p>
                            <pre className="well max-h-48 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-4 text-fg-2">
                              {readableJson(trace.tool_input)}
                            </pre>
                          </div>
                        )}
                        {trace.tool_result && (
                          <div>
                            <p className="meta mb-1">Recorded result</p>
                            <pre className="well max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-4 text-fg-2">
                              {readableJson(trace.tool_result)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
