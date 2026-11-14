import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Pause, Play, RotateCcw } from 'lucide-react';
import type { GraphData, GraphNode, NodeType } from '../../shared/types';
import { ICON, Meter, Segmented } from './ui';

/**
 * The Brain, drawn as a 3D brain: two hemispheres of stippled cortex with folds,
 * and every learned node placed in a region that matches what it is about:
 * voice and hooks up front, visual traits in the occipital (visual) lobe at the back,
 * recurring phrases near the left frontal speech area, and videos spread over the cortex.
 *
 * Plain canvas 2D with a small perspective projection: no 3D library, ~0 kB extra.
 * Drag to rotate. Auto-rotation stops for reduced-motion users. A keyboard-friendly
 * node list sits beside the canvas and drives the same selection.
 */

interface BrainGraphProps {
  data: GraphData;
  onSelectNode?: (node: GraphNode | null) => void;
}

export const TYPE_COLORS: Record<NodeType, string> = {
  Strength: '#15803d',
  Gap: '#c81e1e',
  Style: '#2f5bea',
  Audience: '#57534e',
  Topic: '#a16207',
  Concept: '#525252',
  Video: '#71717a',
  Hook: '#0e7490',
  Phrase: '#9d174d',
  Product: '#c2410c',
  Thumbnail: '#4d7c0f',
  CTA: '#334155',
};

const TYPE_LABEL: Record<NodeType, string> = {
  Strength: 'Strengths',
  Gap: 'Gaps',
  Style: 'Voice',
  Audience: 'Audience',
  Topic: 'Topics',
  Concept: 'Concepts',
  Video: 'Videos',
  Hook: 'Hooks',
  Phrase: 'Phrases',
  Product: 'Products',
  Thumbnail: 'Thumbnails',
  CTA: 'Calls to action',
};

/** Brain regions as ranges of longitude (around the vertical axis, 0 = front) and latitude */
type Region = { lon: [number, number]; lat: [number, number]; side?: -1 | 1 };
const REGIONS: Record<NodeType, Region> = {
  Style: { lon: [-35, 35], lat: [15, 60] }, // frontal, upper
  Hook: { lon: [-50, 50], lat: [-5, 25] }, // frontal, lower
  Phrase: { lon: [-70, -25], lat: [-15, 20], side: -1 }, // left frontal, near Broca's area
  CTA: { lon: [25, 70], lat: [-15, 20], side: 1 }, // right frontal
  Strength: { lon: [40, 140], lat: [40, 80] }, // parietal, top
  Topic: { lon: [-140, -40], lat: [35, 80] }, // parietal, top other side
  Gap: { lon: [70, 120], lat: [-40, 5] }, // temporal, side
  Product: { lon: [-120, -70], lat: [-40, 5] }, // temporal, other side
  Audience: { lon: [150, 210], lat: [10, 45] }, // occipital, upper
  Thumbnail: { lon: [150, 210], lat: [-30, 10] }, // occipital: visual cortex
  Video: { lon: [-180, 180], lat: [-20, 70] }, // spread over the cortex
  Concept: { lon: [-180, 180], lat: [0, 70] },
};

type Filter = 'all' | 'learned' | 'videos' | 'traits';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'learned', label: 'Strengths and gaps' },
  { value: 'traits', label: 'Traits' },
  { value: 'videos', label: 'Videos' },
];
const inFilter = (t: NodeType, f: Filter) =>
  f === 'all' ||
  (f === 'learned' && (t === 'Strength' || t === 'Gap' || t === 'Style' || t === 'Audience' || t === 'Topic')) ||
  (f === 'traits' && (t === 'Hook' || t === 'Phrase' || t === 'Product' || t === 'Thumbnail' || t === 'CTA')) ||
  (f === 'videos' && t === 'Video');

// ---------- geometry ----------

type V3 = [number, number, number];

/** Deterministic pseudo-random from a string (so a node always sits in the same spot) */
function hash(str: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Surface point of a stylized brain for a direction given in degrees.
 * x: left/right, y: up, z: front (+) / back (-).
 */
function brainSurface(lonDeg: number, latDeg: number, lift = 1): V3 {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  let x = Math.cos(lat) * Math.sin(lon);
  let y = Math.sin(lat);
  let z = Math.cos(lat) * Math.cos(lon);
  // Ellipsoid proportions: long front-to-back, a little wider than tall
  x *= 0.8;
  y *= 0.72;
  z *= 1.0;
  // Flatter underside, temporal lobes bulge low at the sides
  if (y < 0) {
    y *= 0.62;
    x *= 1 + 0.12 * Math.min(1, -y * 3) * Math.max(0, Math.cos(lon * 1.3));
  }
  // Longitudinal fissure: split into two hemispheres along the top
  const side = x >= 0 ? 1 : -1;
  x += side * 0.06 * Math.max(0, y + 0.2);
  // Gyri: small folds on the surface
  const fold = 1 + 0.035 * Math.sin(lon * 9 + lat * 4) * Math.cos(lat * 11 - lon * 3);
  return [x * fold * lift, y * fold * lift, z * fold * lift];
}

function nodePosition(node: GraphNode): V3 {
  const r = REGIONS[node.type] || REGIONS.Concept;
  let lon = r.lon[0] + hash(node.id, 1) * (r.lon[1] - r.lon[0]);
  const lat = r.lat[0] + hash(node.id, 2) * (r.lat[1] - r.lat[0]);
  if (!r.side && r.lon[1] - r.lon[0] < 360 && node.type !== 'Video' && hash(node.id, 3) > 0.5 && (node.type === 'Style' || node.type === 'Hook')) {
    lon = -lon; // mirror across hemispheres for frontal traits
  }
  return brainSurface(lon, lat, 1.04);
}

interface Anatomy {
  points: { p: V3; w: number }[]; // stipple; w = base weight
  curves: { pts: V3[]; w: number }[]; // folds, fissures and cerebellum folia
}

/** Cortex stipple and fold lines, plus cerebellum and brainstem, built once */
function buildAnatomy(): Anatomy {
  const points: Anatomy['points'] = [];
  const curves: Anatomy['curves'] = [];

  // Cortex: Fibonacci-sphere sampling mapped onto the brain surface
  const n = 2200;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const lon = (Math.atan2(r * Math.sin(theta), r * Math.cos(theta)) * 180) / Math.PI;
    const lat = (Math.asin(y) * 180) / Math.PI;
    if (lat < -50) continue;
    points.push({ p: brainSurface(lon, lat, 1), w: 1 });
  }

  // Gyri and sulci: wavy fold lines over each hemisphere
  for (const side of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const baseLat = -20 + k * 10;
      const pts: V3[] = [];
      for (let lon = 10; lon <= 170; lon += 3) {
        const lat = baseLat + 5 * Math.sin(lon * 0.11 + k * 1.7) + 2.5 * Math.sin(lon * 0.37 + k);
        pts.push(brainSurface(side * lon, lat, 1.005));
      }
      curves.push({ pts, w: 0.8 });
    }
    // Lateral (Sylvian) fissure: deeper line from front-low sweeping back
    const sylvian: V3[] = [];
    for (let lon = 35; lon <= 125; lon += 3) sylvian.push(brainSurface(side * lon, -12 + (lon - 35) * 0.22, 1.006));
    curves.push({ pts: sylvian, w: 1.8 });
    // Central sulcus: roughly vertical, separating frontal and parietal lobes
    const central: V3[] = [];
    for (let lat = -5; lat <= 85; lat += 3) central.push(brainSurface(side * (75 + 8 * Math.sin(lat * 0.12)), lat, 1.006));
    curves.push({ pts: central, w: 1.4 });
  }
  // Longitudinal fissure along the top, front to back
  const fissure: V3[] = [];
  for (let t = -1; t <= 1.0001; t += 0.04) {
    const z = t * 0.98;
    const y = 0.72 * Math.sqrt(Math.max(0, 1 - t * t)) * 1.0;
    fissure.push([0, y, z]);
  }
  curves.push({ pts: fissure, w: 2 });

  // Cerebellum: small ellipsoid at the back, underneath, with horizontal folia
  const cb = (u: number, v: number): V3 => [Math.cos(v) * Math.sin(u) * 0.44, Math.sin(v) * 0.2 - 0.42, Math.cos(v) * Math.cos(u) * 0.28 - 0.66];
  for (let i = 0; i < 420; i++) {
    const u = hash(`cb${i}`, 1) * Math.PI * 2;
    const v = (hash(`cb${i}`, 2) - 0.5) * Math.PI;
    points.push({ p: cb(u, v), w: 0.9 });
  }
  for (let k = -3; k <= 3; k++) {
    const pts: V3[] = [];
    for (let u = 0; u <= Math.PI * 2 + 0.01; u += 0.12) pts.push(cb(u, k * 0.22));
    curves.push({ pts, w: 0.7 });
  }

  // Brainstem: a short tapered column below the centre
  for (let i = 0; i < 160; i++) {
    const t = hash(`bs${i}`, 1);
    const a = hash(`bs${i}`, 2) * Math.PI * 2;
    const r = 0.13 - t * 0.04;
    points.push({ p: [Math.cos(a) * r, -0.4 - t * 0.5, Math.sin(a) * r * 0.9 - 0.22], w: 0.8 });
  }
  return { points, curves };
}

function rotate([x, y, z]: V3, yaw: number, pitch: number): V3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

// ---------- component ----------

export const BrainGraph: React.FC<BrainGraphProps> = ({ data, onSelectNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const reducedMotion = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [spinning, setSpinning] = useState(!reducedMotion);
  const view = useRef({ yaw: -1.15, pitch: 0.22, drag: null as null | { x: number; y: number; yaw: number; pitch: number } });
  const projected = useRef<{ node: GraphNode; x: number; y: number; r: number; depth: number }[]>([]);

  const anatomy = useMemo(buildAnatomy, []);
  const nodes = useMemo(() => data.nodes.filter((n) => inFilter(n.type, filter)), [data.nodes, filter]);
  const positions = useMemo(() => new Map(data.nodes.map((n) => [n.id, nodePosition(n)])), [data.nodes]);
  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(
    () => data.edges.filter((e) => visibleIds.has(e.source_id) && visibleIds.has(e.target_id)),
    [data.edges, visibleIds]
  );
  const neighbors = useMemo(() => {
    const id = selected?.id;
    if (!id) return new Set<string>();
    return new Set(data.edges.flatMap((e) => (e.source_id === id ? [e.target_id] : e.target_id === id ? [e.source_id] : [])));
  }, [selected, data.edges]);

  const select = (n: GraphNode | null) => {
    setSelected(n);
    onSelectNode?.(n);
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function frame(now: number) {
      const dt = Math.min(64, now - last);
      last = now;
      const v = view.current;
      if (spinning && !v.drag) v.yaw += dt * 0.00012;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap!.clientWidth;
      const h = wrap!.clientHeight;
      if (canvas!.width !== Math.round(w * dpr) || canvas!.height !== Math.round(h * dpr)) {
        canvas!.width = Math.round(w * dpr);
        canvas!.height = Math.round(h * dpr);
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      const scale = Math.min(w, h * 1.25) * 0.42;
      const cx = w / 2;
      const cy = h / 2 - 10;
      const proj = (p: V3) => {
        const [x, y, z] = rotate(p, v.yaw, v.pitch);
        const persp = 3.2 / (3.2 - z);
        return { x: cx + x * scale * persp, y: cy - y * scale * persp, z, persp };
      };

      // Cortex stipple, back to front
      for (const { p, w } of anatomy.points) {
        const q = proj(p);
        const depth = (q.z + 1) / 2; // 0 back .. 1 front
        ctx!.fillStyle = `rgba(23,23,23,${(0.06 + depth * 0.3) * w})`;
        const sz = 0.7 + depth * 1.2;
        ctx!.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
      }
      // Folds and fissures, darker where they face the viewer
      ctx!.lineCap = 'round';
      for (const c of anatomy.curves) {
        for (let i = 1; i < c.pts.length; i++) {
          const a = proj(c.pts[i - 1]);
          const b = proj(c.pts[i]);
          const depth = ((a.z + b.z) / 2 + 1) / 2;
          if (depth < 0.42) continue; // hide folds on the far side
          ctx!.strokeStyle = `rgba(23,23,23,${(depth - 0.42) * 0.42 * c.w})`;
          ctx!.lineWidth = 0.6 + c.w * 0.5 * depth;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      // Edges as arcs that dip toward the centre, like fibres through the brain
      const selId = selected?.id;
      for (const e of edges) {
        const a = positions.get(e.source_id);
        const b = positions.get(e.target_id);
        if (!a || !b) continue;
        const pa = proj(a);
        const pb = proj(b);
        const mid = proj([(a[0] + b[0]) * 0.35, (a[1] + b[1]) * 0.35, (a[2] + b[2]) * 0.35]);
        const active = selId && (e.source_id === selId || e.target_id === selId);
        ctx!.strokeStyle = active ? 'rgba(47,91,234,0.6)' : `rgba(47,91,234,${selId ? 0.03 : 0.07})`;
        ctx!.lineWidth = active ? 1.4 : 1;
        ctx!.beginPath();
        ctx!.moveTo(pa.x, pa.y);
        ctx!.quadraticCurveTo(mid.x, mid.y, pb.x, pb.y);
        ctx!.stroke();
      }

      // Nodes, sorted by depth
      const drawn = nodes
        .map((n) => {
          const q = proj(positions.get(n.id)!);
          return { node: n, x: q.x, y: q.y, depth: (q.z + 1) / 2, persp: q.persp };
        })
        .sort((p, q) => p.depth - q.depth);

      projected.current = [];
      for (const d of drawn) {
        const isSel = d.node.id === selId;
        const isNb = neighbors.has(d.node.id);
        const dim = selId && !isSel && !isNb;
        const base = d.node.type === 'Video' ? 2.6 : 3.8 + (d.node.confidence || 0.5) * 2.6;
        const r = base * d.persp * (isSel ? 1.5 : 1);
        ctx!.globalAlpha = (dim ? 0.18 : 0.35 + d.depth * 0.65) * (d.depth < 0.35 && !isSel ? 0.7 : 1);
        ctx!.fillStyle = TYPE_COLORS[d.node.type] || TYPE_COLORS.Concept;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx!.fill();
        if (isSel || hovered?.id === d.node.id) {
          ctx!.globalAlpha = 1;
          ctx!.strokeStyle = '#171717';
          ctx!.lineWidth = 1.5;
          ctx!.beginPath();
          ctx!.arc(d.x, d.y, r + 3, 0, Math.PI * 2);
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
        projected.current.push({ node: d.node, x: d.x, y: d.y, r: Math.max(r, 8), depth: d.depth });
      }

      // Labels for the selected, hovered and neighbouring nodes in front
      ctx!.font = '12px Geist, ui-sans-serif, system-ui';
      ctx!.textBaseline = 'middle';
      for (const d of drawn) {
        const show = d.node.id === selId || d.node.id === hovered?.id || (isNbVisible(d.node.id) && d.depth > 0.45);
        if (!show) continue;
        const text = d.node.label.length > 42 ? `${d.node.label.slice(0, 40)}…` : d.node.label;
        const tw = ctx!.measureText(text).width;
        const lx = Math.min(w - tw - 12, d.x + 10);
        ctx!.fillStyle = 'rgba(255,255,255,0.92)';
        ctx!.fillRect(lx - 4, d.y - 10, tw + 8, 20);
        ctx!.fillStyle = '#171717';
        ctx!.fillText(text, lx, d.y);
      }

      if (visible && (spinning || v.drag)) raf = requestAnimationFrame(frame);
    }
    function isNbVisible(id: string) {
      return neighbors.has(id);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [anatomy, nodes, edges, positions, neighbors, selected, hovered, spinning]);

  // Pointer interaction: drag to rotate, click to select, hover for labels
  const pick = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: { node: GraphNode; d: number; depth: number } | null = null;
    for (const p of projected.current) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.r && (!best || p.depth > best.depth)) best = { node: p.node, d, depth: p.depth };
    }
    return best?.node || null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    view.current.drag = { x: e.clientX, y: e.clientY, yaw: view.current.yaw, pitch: view.current.pitch };
    setHovered((h) => (h ? { ...h } : h)); // keep the loop running while dragging
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = view.current.drag;
    if (d) {
      view.current.yaw = d.yaw + (e.clientX - d.x) * 0.008;
      view.current.pitch = Math.max(-0.9, Math.min(0.9, d.pitch + (e.clientY - d.y) * 0.006));
      if (!spinning) setHovered((h) => (h ? { ...h } : null)); // trigger a redraw when paused
      return;
    }
    const n = pick(e.clientX, e.clientY);
    if (n?.id !== hovered?.id) setHovered(n);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = view.current.drag;
    view.current.drag = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) select(pick(e.clientX, e.clientY));
  };

  const grouped = useMemo(() => {
    const m = new Map<NodeType, GraphNode[]>();
    for (const n of nodes) m.set(n.type, [...(m.get(n.type) || []), n]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [nodes]);
  const presentTypes = useMemo(() => [...new Set(data.nodes.map((n) => n.type))], [data.nodes]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-line">
        <Segmented<Filter> label="Show" value={filter} onChange={setFilter} options={FILTERS} />
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setSpinning((s) => !s)} aria-pressed={!spinning}>
            {spinning ? <Pause {...ICON} /> : <Play {...ICON} />}
            {spinning ? 'Pause' : 'Rotate'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              view.current.yaw = -1.15;
              view.current.pitch = 0.22;
              setHovered(null);
            }}
          >
            <RotateCcw {...ICON} />
            Reset view
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative">
          <div ref={wrapRef} className="h-[460px] md:h-[540px] relative bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#f4f4f5_70%)]">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
              role="img"
              aria-label={`3D brain with ${data.nodes.length} learned nodes: ${presentTypes
                .map((t) => `${data.nodes.filter((n) => n.type === t).length} ${TYPE_LABEL[t].toLowerCase()}`)
                .join(', ')}. Use the list beside it to explore with a keyboard.`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setHovered(null)}
            />
            <p className="absolute left-4 bottom-3 meta pointer-events-none">Drag to rotate · click a node</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 border-t border-line" aria-label="Legend">
            {presentTypes.map((t) => (
              <li key={t} className="flex items-center gap-2 text-[12px] text-fg-2">
                <span className="dot" style={{ background: TYPE_COLORS[t] }} aria-hidden="true" />
                {TYPE_LABEL[t]}
              </li>
            ))}
          </ul>
        </div>

        <aside className="border-t lg:border-t-0 lg:border-l border-line flex flex-col max-h-[620px]" aria-label="Brain nodes">
          {selected ? (
            <div className="p-4 border-b border-line" role="region" aria-live="polite" aria-label="Selected node">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-[12px] text-fg-3">
                  <span className="dot" style={{ background: TYPE_COLORS[selected.type] }} aria-hidden="true" />
                  {TYPE_LABEL[selected.type]}
                </div>
                <button className="btn btn-ghost btn-sm px-2 h-7" onClick={() => select(null)} aria-label="Close node details">
                  <X {...ICON} />
                </button>
              </div>
              <div className="mt-2 font-medium leading-5">{selected.label}</div>
              {selected.description && <p className="mt-1 text-[13px] text-fg-2 leading-5">{selected.description}</p>}
              <div className="mt-3 flex items-center gap-2">
                <Meter value={selected.confidence || 0} label="Confidence" />
                <span className="meta">{Math.round((selected.confidence || 0) * 100)}% confidence</span>
              </div>
              <p className="meta mt-2">{neighbors.size} connections</p>
            </div>
          ) : (
            <p className="p-4 border-b border-line text-[13px] text-fg-2">
              Pick a node in the brain or in this list to see what it means and what it connects to
            </p>
          )}
          <div className="overflow-y-auto flex-1">
            {grouped.map(([type, list]) => (
              <section key={type} aria-label={TYPE_LABEL[type]}>
                <h3 className="px-4 pt-3 pb-1 text-[12px] text-fg-3 flex items-center gap-2">
                  <span className="dot" style={{ background: TYPE_COLORS[type] }} aria-hidden="true" />
                  {TYPE_LABEL[type]} <span className="meta">{list.length}</span>
                </h3>
                <ul>
                  {list.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => select(selected?.id === n.id ? null : n)}
                        onFocus={() => setHovered(n)}
                        onBlur={() => setHovered(null)}
                        aria-pressed={selected?.id === n.id}
                        className={`w-full text-left px-4 py-[6px] text-[13px] leading-5 truncate transition-colors ${
                          selected?.id === n.id ? 'bg-raised text-fg' : 'text-fg-2 hover:bg-raised/60 hover:text-fg'
                        }`}
                      >
                        {n.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
