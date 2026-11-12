import React, { useEffect, useState } from 'react';
import { Bot, Play, RefreshCw, Terminal, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import type { AgentTrace } from '../../shared/types';

export const AgentsTab: React.FC = () => {
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [_loading, setLoading] = useState(true);
  const [isRunningAgents, setIsRunningAgents] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgentsNow = async () => {
    setIsRunningAgents(true);
    setRunMessage(null);
    try {
      const res = await api.agents.runNow();
      setTraces(res.traces || []);
      setRunMessage(
        `Orchestrator finished run. Next Best Action: "${res.nextBestAction}". Memory Curator logged new learning.`
      );
      setTimeout(() => setRunMessage(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown agent error';
      setRunMessage(`Error running agents: ${msg}`);
    } finally {
      setIsRunningAgents(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      {/* Top Header */}
      <div className="glass-panel p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            Autonomous Agent Execution Fleet
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time step-by-step traces of all 13 specialized AI agents in the CreatorBrain operating system.
          </p>
        </div>

        <button
          onClick={handleRunAgentsNow}
          disabled={isRunningAgents}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
        >
          {isRunningAgents ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          {isRunningAgents ? 'Executing Agent Loop...' : 'Run Agents Now'}
        </button>
      </div>

      {runMessage && (
        <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-300 flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          {runMessage}
        </div>
      )}

      {/* Trace Timeline List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recent Agent Traces ({traces.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Max 6 steps per autonomous loop</span>
        </div>

        <div className="relative border-l-2 border-white/[0.08] ml-4 space-y-6 pb-4">
          {traces.map((trace) => (
            <div key={trace.id} className="relative pl-6 group">
              {/* Timeline Dot */}
              <div
                className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-[#05070e] flex items-center justify-center ${
                  trace.status === 'success'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : trace.status === 'running'
                    ? 'bg-indigo-400 animate-ping'
                    : 'bg-rose-400'
                }`}
              />

              <div className="glass-card p-4 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {trace.agent_name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Step {trace.step_number} of {trace.total_steps}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(trace.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  {trace.output_summary}
                </p>

                {trace.tool_called && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] text-[11px] font-mono space-y-1">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold">
                      <Terminal className="w-3.5 h-3.5" /> Tool: {trace.tool_called}
                    </div>
                    {trace.tool_input && (
                      <p className="text-slate-400 truncate">Args: {trace.tool_input}</p>
                    )}
                    {trace.tool_result && (
                      <p className="text-emerald-400/90 truncate">Result: {trace.tool_result}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
