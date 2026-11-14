import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import type { GraphData, GraphNode, NodeType } from '../../shared/types';
import { ICON, Meter, Segmented } from './ui';

interface BrainGraphProps {
  data: GraphData;
  onSelectNode?: (node: GraphNode | null) => void;
}

// Each hue means one node type. Muted, distinct, no glow.
const TYPE_COLORS: Record<NodeType, string> = {
  Strength: '#16a34a',
  Gap: '#dc2626',
  Style: '#2f5bea',
  Audience: '#737373',
  Topic: '#a16207',
  Concept: '#525252',
  Video: '#a1a1aa',
};

const LEGEND: NodeType[] = ['Strength', 'Gap', 'Style', 'Audience', 'Topic', 'Video'];

const EDGE = 'rgba(23,23,23,0.14)';
const EDGE_ACTIVE = 'rgba(23,23,23,0.48)';

type Filter = 'all' | 'Strength' | 'Gap' | 'Style' | 'Audience' | 'Topic' | 'Video';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Strength', label: 'Strengths' },
  { value: 'Gap', label: 'Gaps' },
  { value: 'Style', label: 'Style' },
  { value: 'Audience', label: 'Audience' },
  { value: 'Topic', label: 'Topics' },
  { value: 'Video', label: 'Videos' },
];

export const BrainGraph: React.FC<BrainGraphProps> = ({ data, onSelectNode }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<Filter>('all');

  // Fixed 2D positions on a ring, offset per type so clusters separate
  const nodePositions = useMemo(() => {
    const width = 800;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 200;

    const positions = new Map<string, { x: number; y: number }>();
    const total = data.nodes.length || 1;

    data.nodes.forEach((node, i) => {
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
      positions.set(node.id, { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) });
    });

    return positions;
  }, [data.nodes]);

  const handleNodeClick = (node: GraphNode) => {
    const next = selectedNode?.id === node.id ? null : node;
    setSelectedNode(next);
    if (onSelectNode) onSelectNode(next);
  };

  const closeDetails = () => {
    const prev = selectedNode;
    setSelectedNode(null);
    if (onSelectNode) onSelectNode(null);
    // Return keyboard focus to the node that opened the details
    if (prev) document.getElementById(`graph-node-${prev.id}`)?.focus();
  };

  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return data.nodes;
    return data.nodes.filter((n) => n.type === filterType);
  }, [data.nodes, filterType]);

  return (
    <div className="flex flex-col">
      {/* Controls and legend */}
      <div className="flex flex-col gap-3 px-5 py-4 border-b border-line lg:flex-row lg:items-center lg:justify-between">
        <Segmented value={filterType} options={FILTERS} onChange={setFilterType} label="Filter nodes by type" />
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Node types">
          {LEGEND.map((t) => (
            <li key={t} className="flex items-center gap-2 text-[12px] text-fg-2">
              <span className="dot" aria-hidden="true" style={{ background: TYPE_COLORS[t] }} />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Canvas */}
      <div className="relative h-[520px] bg-surface">
        <svg
          viewBox="0 0 800 520"
          className="w-full h-full select-none"
          role="group"
          aria-label={`Brain graph: ${filteredNodes.length} nodes, ${data.edges.length} connections. Tab to a node and press Enter to see its details.`}
        >
          {/* Reference rings */}
          <circle cx="400" cy="260" r="200" fill="none" stroke="rgba(23,23,23,0.06)" aria-hidden="true" />
          <circle cx="400" cy="260" r="120" fill="none" stroke="rgba(23,23,23,0.04)" aria-hidden="true" />

          {/* Edges */}
          <g aria-hidden="true">
          {data.edges.map((edge) => {
            const s = nodePositions.get(edge.source_id);
            const t = nodePositions.get(edge.target_id);
            if (!s || !t) return null;

            const active =
              !!selectedNode && (selectedNode.id === edge.source_id || selectedNode.id === edge.target_id);

            return (
              <line
                key={edge.id}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={active ? EDGE_ACTIVE : EDGE}
                strokeWidth={active ? 1.5 : 1}
                strokeDasharray={edge.relation === 'NEEDS_WORK' ? '4 4' : undefined}
              />
            );
          })}
          </g>

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const color = TYPE_COLORS[node.type] || TYPE_COLORS.Concept;
            const isSelected = selectedNode?.id === node.id;
            const isHovered = hoveredNode?.id === node.id || focusedId === node.id;
            const isFocused = focusedId === node.id;
            const r = 6 + Math.round((node.confidence || 0.8) * 4) + (isSelected || isHovered ? 2 : 0);

            return (
              <g
                key={node.id}
                id={`graph-node-${node.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer outline-none"
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${node.label}, ${node.type}, ${Math.round((node.confidence || 0) * 100)}% confidence`}
                onClick={() => handleNodeClick(node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNodeClick(node);
                  } else if (e.key === 'Escape' && selectedNode) {
                    e.preventDefault();
                    closeDetails();
                  }
                }}
                onFocus={() => setFocusedId(node.id)}
                onBlur={() => setFocusedId((id) => (id === node.id ? null : id))}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {isFocused && <circle r={r + 7} fill="none" stroke="#2f5bea" strokeWidth={2} />}
                {isSelected && <circle r={r + 4} fill="none" stroke="#171717" strokeWidth={1} />}
                <circle r={r} fill={color} stroke="#ffffff" strokeWidth={2} />
                <text
                  dy={r + 16}
                  textAnchor="middle"
                  fill={isSelected || isHovered ? '#171717' : '#525252'}
                  style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}
                  className="pointer-events-none"
                  aria-hidden="true"
                >
                  {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected node details */}
        {selectedNode && (
          <div
            className="card absolute bottom-4 left-4 right-4 p-4 flex items-start justify-between gap-4"
            role="region"
            aria-label="Node details"
            aria-live="polite"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-2 text-[12px] text-fg-2">
                  <span className="dot" aria-hidden="true" style={{ background: TYPE_COLORS[selectedNode.type] || TYPE_COLORS.Concept }} />
                  {selectedNode.type}
                </span>
                <h3 className="font-medium text-fg">{selectedNode.label}</h3>
                <span className="flex items-center gap-2">
                  <Meter value={selectedNode.confidence || 0} />
                  <span className="meta">{Math.round((selectedNode.confidence || 0) * 100)}% confidence</span>
                </span>
              </div>
              {selectedNode.description && (
                <p className="mt-2 text-[13px] text-fg-2 max-w-2xl">{selectedNode.description}</p>
              )}
            </div>
            <button type="button" onClick={closeDetails} className="btn btn-ghost btn-sm" aria-label="Close details">
              <X {...ICON} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
