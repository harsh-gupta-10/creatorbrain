import React, { useEffect, useState } from 'react';
import {
  Brain as BrainIcon,
  Sparkles,
  Activity,
  Zap,
  Mic,
  Palette,
  Package,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { BrainGraph } from '../components/BrainGraph';
import type { CreatorDNA, Learning, GraphNode, GraphEdge } from '../../shared/types';

export const BrainTab: React.FC = () => {
  const [dna, setDna] = useState<CreatorDNA | null>(null);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    loadBrainData();
  }, []);

  const loadBrainData = async () => {
    setLoading(true);
    try {
      const graphRes = await api.brain.getGraph();
      setDna(graphRes.creatorDNA);
      setLearnings(graphRes.learnings || []);
      setGraphData({
        nodes: graphRes.graph?.nodes || [],
        edges: graphRes.graph?.edges || [],
      });
      setNodeCounts(graphRes.nodeCounts || {});
    } catch (err: unknown) {
      console.error('Failed to load brain knowledge graph:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BrainIcon className="w-5 h-5 text-indigo-600" />
            Creator Brain Knowledge Graph
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Persistent creator intelligence: styles, strengths, retention gaps, audience clusters, and content pillars.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-700">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            Live Memory Graph Active
          </div>
        </div>
      </div>

      {/* Creator DNA Card (4 Pillars) */}
      {dna && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Synthesized Creator DNA Profile
            </h3>
            <span className="text-[10px] text-emerald-700 font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
              High Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Voice Pillar */}
            <div className="bg-slate-50/70 border border-slate-200/80 p-4.5 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                <Mic className="w-4 h-4 text-indigo-600" /> Voice & Delivery
              </div>
              <p className="text-xs text-slate-900 font-medium">{dna.voice.tone}</p>
              <div className="text-[11px] text-slate-600">
                <span className="text-slate-400">Mix:</span> {dna.voice.language_mix}
              </div>
              <div className="text-[11px] text-slate-600">
                <span className="text-slate-400">Hook:</span> {dna.voice.hook_formula}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {dna.voice.catchphrases.map((phrase, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-indigo-700 font-medium shadow-2xs"
                  >
                    "{phrase}"
                  </span>
                ))}
              </div>
            </div>

            {/* Visual Pillar */}
            <div className="bg-slate-50/70 border border-slate-200/80 p-4.5 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                <Palette className="w-4 h-4 text-indigo-600" /> Visual & Thumbnail
              </div>
              <p className="text-xs text-slate-900 font-medium">{dna.visual.composition}</p>
              <div className="text-[11px] text-slate-600">
                <span className="text-slate-400">Text Words:</span> {dna.visual.text_overlay_words} words max
              </div>
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 block mb-1">Thumbnail Palette:</span>
                <div className="flex items-center gap-1.5">
                  {dna.visual.thumbnail_palette.map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border border-slate-300 shadow-xs"
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Packaging Pillar */}
            <div className="bg-slate-50/70 border border-slate-200/80 p-4.5 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                <Package className="w-4 h-4 text-amber-600" /> Packaging & Titles
              </div>
              <div className="text-xs text-slate-900 font-medium">
                Avg Title: <span className="font-mono text-slate-900 font-semibold">{dna.packaging.title_avg_length} chars</span>
              </div>
              <div className="space-y-1 pt-1">
                {dna.packaging.title_patterns.slice(0, 2).map((pat, i) => (
                  <div key={i} className="text-[10px] font-mono text-slate-700 truncate bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                    {pat}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 pt-1">
                Disclosure: {dna.packaging.disclosure_position}
              </p>
            </div>

            {/* Audience Pillar */}
            <div className="bg-slate-50/70 border border-slate-200/80 p-4.5 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <Users className="w-4 h-4 text-emerald-600" /> Audience & Intent
              </div>
              <p className="text-xs text-slate-900 font-medium">{dna.audience.primary_demographic}</p>
              <div className="text-[11px] text-slate-600 mt-2">
                <span className="text-slate-400">Buying Intent:</span> {dna.audience.buying_intent}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Graph View */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 overflow-hidden shadow-xs">
        <BrainGraph data={graphData} />
      </div>

      {/* Bottom Grid: Node Count Cards & Last 5 Learnings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Node Counts (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Graph Topology Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs text-indigo-700 font-semibold">Styles</span>
              <span className="text-sm font-bold font-mono text-slate-900">{nodeCounts.style || 0}</span>
            </div>
            <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-semibold">Strengths</span>
              <span className="text-sm font-bold font-mono text-slate-900">{nodeCounts.strength || 0}</span>
            </div>
            <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs text-rose-700 font-semibold">Gaps</span>
              <span className="text-sm font-bold font-mono text-slate-900">{nodeCounts.gap || 0}</span>
            </div>
            <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs text-indigo-700 font-semibold">Audience</span>
              <span className="text-sm font-bold font-mono text-slate-900">{nodeCounts.audience || 0}</span>
            </div>
            <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs text-amber-700 font-semibold">Topics</span>
              <span className="text-sm font-bold font-mono text-slate-900">{nodeCounts.topic || 0}</span>
            </div>
            <div className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs text-slate-600 font-semibold">Total Edges</span>
              <span className="text-sm font-bold font-mono text-slate-900">{graphData.edges.length}</span>
            </div>
          </div>
        </div>

        {/* Last 5 Learnings (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Last 5 Learnings & Autonomous Graph Updates
          </h3>

          <div className="space-y-2.5">
            {learnings.map((l) => (
              <div
                key={l.id}
                className="bg-slate-50/70 border border-slate-200/80 p-3.5 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">{l.title}</h4>
                  <span className="text-[10px] font-mono text-indigo-700 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 font-medium">
                    {l.source_agent}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{l.insight}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
