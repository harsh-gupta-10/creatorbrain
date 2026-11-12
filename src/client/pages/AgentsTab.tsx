import React, { useEffect, useState } from 'react';
import {
  Play,
  Terminal,
  RefreshCw,
  Sparkles,
  Bot,
} from 'lucide-react';
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
    } catch (err) {
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
    } catch (err: any) {
      setRunMessage(`Error running agents: ${err.message}`);
    } finally {
      setIsRunningAgents(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            Autonomous Agent Execution Timeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time step-by-step traces of all 13 specialized AI agents in the CreatorBrain operating system.
          </p>
        </div>

        <button
          onClick={handleRunAgentsNow}
          disabled={isRunningAgents}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/25 active:scale-95 disabled:opacity-50"
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
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300 flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          {runMessage}
        </div>
      )}

      {/* Trace Timeline List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recent Agent Traces ({traces.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Max 6 steps per run</span>
        </div>

        <div className="relative border-l-2 border-slate-800 ml-4 space-y-6 pb-4">
          {traces.map((trace) => (
            <div key={trace.id} className="relative pl-6 group">
              {/* Timeline Dot */}
              <div
                className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center ${
                  trace.status === 'success'
                    ? 'bg-emerald-500'
                    : trace.status === 'running'
                    ? 'bg-cyan-500 animate-ping'
                    : 'bg-rose-500'
                }`}
              />

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-lg bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
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
                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] font-mono space-y-1">
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
