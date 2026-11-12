import React, { useEffect, useState } from 'react';
import {
  Brain as BrainIcon,
  Sparkles,
  Zap,
  Activity,
  Mic,
  Palette,
  Package,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { BrainGraph } from '../components/BrainGraph';
import type { GraphData, Learning, CreatorDNA } from '../../shared/types';

export const BrainTab: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [dna, setDna] = useState<CreatorDNA | null>(null);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    loadBrainData();
  }, []);

  const loadBrainData = async () => {
    setLoading(true);
    try {
      const res = await api.brain.getGraph();
      setGraphData(res.graph || { nodes: [], edges: [] });
      setLearnings(res.learnings || []);
      setNodeCounts(res.nodeCounts || {});
      setDna(res.creatorDNA);
    } catch (err) {
      console.error('Failed to load brain data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BrainIcon className="w-5 h-5 text-purple-400" />
            Creator Brain Knowledge Graph
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Persistent creator intelligence: styles, strengths, retention gaps, audience clusters, and content pillars.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-semibold text-purple-300">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Live Memory Graph
          </div>
        </div>
      </div>

      {/* Creator DNA Card (4 Pillars) */}
      {dna && (
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Synthesized Creator DNA Profile
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
              High Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Voice Pillar */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                <Mic className="w-4 h-4" /> Voice & Delivery
              </div>
              <p className="text-xs text-slate-300 font-medium">{dna.voice.tone}</p>
              <div className="text-[11px] text-slate-400">
                <span className="text-slate-500">Mix:</span> {dna.voice.language_mix}
              </div>
              <div className="text-[11px] text-slate-400">
                <span className="text-slate-500">Hook:</span> {dna.voice.hook_formula}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {dna.voice.catchphrases.map((phrase, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20"
                  >
                    "{phrase}"
                  </span>
                ))}
              </div>
            </div>

            {/* Visual Pillar */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <Palette className="w-4 h-4" /> Visual & Thumbnail
              </div>
              <p className="text-xs text-slate-300 font-medium">{dna.visual.composition}</p>
              <div className="text-[11px] text-slate-400">
                <span className="text-slate-500">Text Words:</span> {dna.visual.text_overlay_words} words max
              </div>
              <div className="pt-2">
                <span className="text-[10px] text-slate-500 block mb-1">Thumbnail Palette:</span>
                <div className="flex items-center gap-1.5">
                  {dna.visual.thumbnail_palette.map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border border-slate-700 shadow-sm"
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Packaging Pillar */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Package className="w-4 h-4" /> Packaging & Titles
              </div>
              <div className="text-xs text-slate-300 font-medium">
                Avg Title Length: <span className="font-mono text-amber-300">{dna.packaging.title_avg_length} chars</span>
              </div>
              <div className="space-y-1 pt-1">
                {dna.packaging.title_patterns.slice(0, 2).map((pat, i) => (
                  <div key={i} className="text-[10px] font-mono text-slate-400 truncate bg-slate-900 p-1 rounded">
                    {pat}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                Disclosure: {dna.packaging.disclosure_position}
              </p>
            </div>

            {/* Audience Pillar */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Users className="w-4 h-4" /> Audience & Intent
              </div>
              <p className="text-xs text-slate-300 font-medium">{dna.audience.primary_demographic}</p>
              <div className="text-[11px] text-slate-400 mt-2">
                <span className="text-slate-500">Buying Intent:</span> {dna.audience.buying_intent}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Graph View */}
      <BrainGraph data={graphData} />

      {/* Bottom Grid: Node Count Cards & Last 5 Learnings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Node Counts (5 Cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Graph Topology Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-purple-400 font-semibold">Styles</span>
              <span className="text-sm font-bold font-mono text-white">{nodeCounts.style || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold">Strengths</span>
              <span className="text-sm font-bold font-mono text-white">{nodeCounts.strength || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-rose-400 font-semibold">Gaps</span>
              <span className="text-sm font-bold font-mono text-white">{nodeCounts.gap || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-cyan-400 font-semibold">Audience</span>
              <span className="text-sm font-bold font-mono text-white">{nodeCounts.audience || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-amber-400 font-semibold">Topics</span>
              <span className="text-sm font-bold font-mono text-white">{nodeCounts.topic || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold">Total Edges</span>
              <span className="text-sm font-bold font-mono text-white">{graphData.edges.length}</span>
            </div>
          </div>
        </div>

        {/* Last 5 Learnings (7 Cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Last 5 Learnings & Autonomous Graph Updates
          </h3>

          <div className="space-y-2.5">
            {learnings.map((l) => (
              <div
                key={l.id}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">{l.title}</h4>
                  <span className="text-[10px] font-mono text-purple-400 px-2 py-0.5 rounded bg-purple-500/10">
                    {l.source_agent}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{l.insight}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
