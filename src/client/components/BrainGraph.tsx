import React, { useState, useMemo } from 'react';
import type { GraphData, GraphNode, NodeType } from '../../shared/types';

interface BrainGraphProps {
  data: GraphData;
  onSelectNode?: (node: GraphNode | null) => void;
}

const TYPE_COLORS: Record<NodeType, { fill: string; stroke: string; text: string; bg: string }> = {
  Style: { fill: '#8b5cf6', stroke: '#a78bfa', text: '#ddd6fe', bg: 'rgba(139, 92, 246, 0.15)' },
  Strength: { fill: '#10b981', stroke: '#34d399', text: '#a7f3d0', bg: 'rgba(16, 185, 129, 0.15)' },
  Gap: { fill: '#ef4444', stroke: '#f87171', text: '#fecaca', bg: 'rgba(239, 68, 68, 0.15)' },
  Audience: { fill: '#06b6d4', stroke: '#22d3ee', text: '#a5f3fc', bg: 'rgba(6, 182, 212, 0.15)' },
  Topic: { fill: '#f59e0b', stroke: '#fbbf24', text: '#fde68a', bg: 'rgba(245, 158, 11, 0.15)' },
  Concept: { fill: '#3b82f6', stroke: '#60a5fa', text: '#bfdbfe', bg: 'rgba(59, 130, 246, 0.15)' },
};

export const BrainGraph: React.FC<BrainGraphProps> = ({ data, onSelectNode }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Compute fixed 2D positions in a circular/clustered force layout
  const nodePositions = useMemo(() => {
    const width = 800;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 210;

    const positions = new Map<string, { x: number; y: number }>();
    const total = data.nodes.length || 1;

    data.nodes.forEach((node, i) => {
      // Golden angle distribution with type cluster jitter
      const angle = (i * 2 * Math.PI) / total;
      const typeOffset =
        node.type === 'Style'
          ? -30
          : node.type === 'Strength'
          ? 20
          : node.type === 'Gap'
          ? -10
          : node.type === 'Audience'
          ? 40
          : 0;

      const r = radius + typeOffset;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);

      positions.set(node.id, { x, y });
    });

    return positions;
  }, [data.nodes]);

  const handleNodeClick = (node: GraphNode) => {
    const next = selectedNode?.id === node.id ? null : node;
    setSelectedNode(next);
    if (onSelectNode) onSelectNode(next);
  };

  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return data.nodes;
    return data.nodes.filter((n) => n.type === filterType);
  }, [data.nodes, filterType]);

  return (
    <div className="relative w-full h-[540px] bg-slate-950/70 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl flex flex-col">
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
          Filter Graph:
        </span>
        {['all', 'Strength', 'Gap', 'Style', 'Audience', 'Topic'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              filterType === t
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {t === 'all' ? 'All Nodes' : t}
          </button>
        ))}
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox="0 0 800 520"
        className="w-full h-full cursor-crosshair select-none"
      >
        <defs>
          <radialGradient id="graphGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
          </radialGradient>
          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Center Glow */}
        <circle cx="400" cy="260" r="300" fill="url(#graphGlow)" />

        {/* Orbit helper rings */}
        <circle cx="400" cy="260" r="210" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeDasharray="4 6" />
        <circle cx="400" cy="260" r="120" fill="none" stroke="rgba(51, 65, 85, 0.15)" strokeDasharray="2 4" />

        {/* Edges */}
        {data.edges.map((edge) => {
          const s = nodePositions.get(edge.source_id);
          const t = nodePositions.get(edge.target_id);
          if (!s || !t) return null;

          const isConnectedToSelected =
            selectedNode &&
            (selectedNode.id === edge.source_id || selectedNode.id === edge.target_id);

          const strokeColor =
            edge.relation === 'STRONG_AT'
              ? '#10b981'
              : edge.relation === 'NEEDS_WORK'
              ? '#ef4444'
              : edge.relation === 'LEARNED_FROM'
              ? '#8b5cf6'
              : '#06b6d4';

          return (
            <g key={edge.id}>
              <line
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={strokeColor}
                strokeWidth={isConnectedToSelected ? 2.5 : 1.2}
                strokeOpacity={isConnectedToSelected ? 0.9 : 0.3}
                strokeDasharray={edge.relation === 'NEEDS_WORK' ? '4 3' : undefined}
                className="transition-all duration-300"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {filteredNodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;

          const style = TYPE_COLORS[node.type] || TYPE_COLORS.Concept;
          const isSelected = selectedNode?.id === node.id;
          const isHovered = hoveredNode?.id === node.id;
          const radius = isSelected ? 22 : isHovered ? 19 : 14 + Math.round((node.confidence || 0.8) * 4);

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Pulse effect on hover/selected */}
              {(isSelected || isHovered) && (
                <circle
                  r={radius + 8}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth="1.5"
                  opacity="0.4"
                  className="animate-ping"
                />
              )}

              {/* Node Circle */}
              <circle
                r={radius}
                fill={style.fill}
                stroke={isSelected ? '#ffffff' : style.stroke}
                strokeWidth={isSelected ? 3 : 1.5}
                filter="url(#glowEffect)"
                className="transition-all duration-200"
              />

              {/* Node Label Text */}
              <text
                dy={radius + 16}
                textAnchor="middle"
                className="text-[11px] font-medium tracking-tight fill-slate-300 pointer-events-none drop-shadow"
              >
                {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 border border-slate-700/80 rounded-xl p-4 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md flex-shrink-0"
              style={{ background: TYPE_COLORS[selectedNode.type]?.fill || '#6366f1' }}
            >
              {selectedNode.type.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">{selectedNode.label}</h4>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedNode.type}
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                  {Math.round((selectedNode.confidence || 0) * 100)}% Confidence
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{selectedNode.description}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition"
          >
            Close Details
          </button>
        </div>
      )}
    </div>
  );
};
