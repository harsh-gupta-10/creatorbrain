import React, { useState, useMemo } from 'react';
import type { GraphData, GraphNode, NodeType } from '../../shared/types';

interface BrainGraphProps {
  data: GraphData;
  onSelectNode?: (node: GraphNode | null) => void;
}

const TYPE_COLORS: Record<NodeType, { fill: string; stroke: string; text: string; bg: string }> = {
  Style: { fill: '#6366f1', stroke: '#4f46e5', text: '#4338ca', bg: '#e0e7ff' },
  Strength: { fill: '#10b981', stroke: '#059669', text: '#065f46', bg: '#d1fae5' },
  Gap: { fill: '#ef4444', stroke: '#dc2626', text: '#991b1b', bg: '#fee2e2' },
  Audience: { fill: '#0ea5e9', stroke: '#0284c7', text: '#075985', bg: '#e0f2fe' },
  Topic: { fill: '#f59e0b', stroke: '#d97706', text: '#92400e', bg: '#fef3c7' },
  Concept: { fill: '#8b5cf6', stroke: '#7c3aed', text: '#5b21b6', bg: '#ede9fe' },
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
    <div className="relative w-full h-[540px] bg-slate-50/40 border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col">
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
          Filter Graph:
        </span>
        {['all', 'Strength', 'Gap', 'Style', 'Audience', 'Topic'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
              filterType === t
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
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
          <radialGradient id="graphGlowLight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Center Glow */}
        <circle cx="400" cy="260" r="300" fill="url(#graphGlowLight)" />

        {/* Orbit helper rings */}
        <circle cx="400" cy="260" r="210" fill="none" stroke="rgba(203, 213, 225, 0.7)" strokeDasharray="4 6" />
        <circle cx="400" cy="260" r="120" fill="none" stroke="rgba(203, 213, 225, 0.5)" strokeDasharray="2 4" />

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
              ? '#6366f1'
              : '#0ea5e9';

          return (
            <g key={edge.id}>
              <line
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={strokeColor}
                strokeWidth={isConnectedToSelected ? 2.5 : 1.2}
                strokeOpacity={isConnectedToSelected ? 0.9 : 0.4}
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
                stroke={isSelected ? '#0f172a' : '#ffffff'}
                strokeWidth={isSelected ? 3 : 2}
                className="transition-all duration-200 shadow-sm"
              />

              {/* Node Label Text */}
              <text
                dy={radius + 16}
                textAnchor="middle"
                className="text-[11px] font-semibold tracking-tight fill-slate-800 pointer-events-none"
              >
                {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs flex-shrink-0"
              style={{ background: TYPE_COLORS[selectedNode.type]?.fill || '#6366f1' }}
            >
              {selectedNode.type.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">{selectedNode.label}</h4>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedNode.type}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold font-mono">
                  {Math.round((selectedNode.confidence || 0) * 100)}% Confidence
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">{selectedNode.description}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedNode(null)}
            className="text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition font-medium"
          >
            Close Details
          </button>
        </div>
      )}
    </div>
  );
};
