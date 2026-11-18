import React, { useEffect, useMemo, useState } from 'react';
import { Brain as BrainIcon, RotateCw } from 'lucide-react';
import { useStudyRefresh } from '../components/StudyBanner';
import { api } from '../lib/api';
import { BrainGraph } from '../components/BrainGraph';
import { EmptyState, ErrorNote, ICON, Meter, PageHeader, SectionTitle, Spinner, formatDate } from '../components/ui';
import type { CreatorDNA, Learning, GraphNode, GraphEdge } from '../../shared/types';

const COUNT_ROWS: { key: string; label: string; color: string }[] = [
  { key: 'strength', label: 'Strengths', color: '#16a34a' },
  { key: 'gap', label: 'Gaps', color: '#dc2626' },
  { key: 'style', label: 'Style', color: '#2f5bea' },
  { key: 'audience', label: 'Audience', color: '#737373' },
  { key: 'topic', label: 'Topics', color: '#a16207' },
];

export const BrainTab: React.FC = () => {
  const [dna, setDna] = useState<CreatorDNA | null>(null);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [nodeCounts, setNodeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useStudyRefresh(() => loadBrainData());
  useEffect(() => {
    loadBrainData();
  }, []);

  const loadBrainData = async () => {
    setLoading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Could not load the Brain');
    } finally {
      setLoading(false);
    }
  };

  const topNodes = useMemo(
    () => [...graphData.nodes].sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 5),
    [graphData.nodes]
  );

  const isEmpty = !loading && graphData.nodes.length === 0;

  return (
    <div>
      <PageHeader
        title="Brain"
        description="What CreatorBrain has learned from your published videos and posts: your style, strengths, gaps, audience and topics."
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadBrainData} disabled={loading}>
            {loading ? <Spinner size={16} /> : <RotateCw {...ICON} />}
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="space-y-8">
        {/* Graph: the one rich visual on this screen */}
        <section className="panel overflow-hidden" aria-labelledby="brain-graph-heading">
          <h2 id="brain-graph-heading" className="sr-only">
            Knowledge graph
          </h2>
          {loading && graphData.nodes.length === 0 ? (
            <div className="h-[520px] flex items-center justify-center text-fg-3" role="status">
              <Spinner size={16} />
              <span className="sr-only">Loading the Brain</span>
            </div>
          ) : isEmpty ? (
            <EmptyState
              icon={<BrainIcon {...ICON} />}
              title="The Brain is empty for now"
              description="It fills in after the channel study finishes. Each node is something learned from your published content, with a confidence level."
            />
          ) : (
            <BrainGraph data={graphData} />
          )}
        </section>

        {/* Creator profile */}
        {dna && (
          <section>
            <SectionTitle title="Creator profile" />
            <div className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 lg:divide-x divide-line">
              <div className="p-5 space-y-3">
                <div className="text-[13px] text-fg-3">Voice and delivery</div>
                <p className="text-fg">{dna.voice.tone}</p>
                <dl className="space-y-1 text-[13px]">
                  <div>
                    <dt className="inline text-fg-3">Language mix </dt>
                    <dd className="inline text-fg-2">{dna.voice.language_mix}</dd>
                  </div>
                  <div>
                    <dt className="inline text-fg-3">Hook </dt>
                    <dd className="inline text-fg-2">{dna.voice.hook_formula}</dd>
                  </div>
                </dl>
                {dna.voice.catchphrases.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dna.voice.catchphrases.map((phrase, i) => (
                      <span key={i} className="tag">
                        “{phrase}”
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3">
                <div className="text-[13px] text-fg-3">Thumbnails</div>
                <p className="text-fg">{dna.visual.composition}</p>
                <div className="text-[13px] text-fg-2">
                  Up to <span className="num">{dna.visual.text_overlay_words}</span> words of overlay text
                </div>
                {dna.visual.thumbnail_palette.length > 0 && (
                  <div className="flex items-center gap-1">
                    {dna.visual.thumbnail_palette.map((color, i) => (
                      <span
                        key={i}
                        className="w-5 h-5 rounded-[4px] border border-line-strong"
                        style={{ background: color }}
                        title={color}
                        role="img"
                        aria-label={`Colour ${color}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3">
                <div className="text-[13px] text-fg-3">Packaging and titles</div>
                <p className="text-fg">
                  Titles average <span className="num">{dna.packaging.title_avg_length}</span> characters
                </p>
                <ul className="space-y-1">
                  {dna.packaging.title_patterns.slice(0, 2).map((pat, i) => (
                    <li key={i} className="well px-2 py-1 font-mono text-[12px] text-fg-2 truncate">
                      {pat}
                    </li>
                  ))}
                </ul>
                <p className="text-[13px] text-fg-2">
                  <span className="text-fg-3">Disclosure </span>
                  {dna.packaging.disclosure_position}
                </p>
              </div>

              <div className="p-5 space-y-3">
                <div className="text-[13px] text-fg-3">Audience</div>
                <p className="text-fg">{dna.audience.primary_demographic}</p>
                <p className="text-[13px] text-fg-2">
                  <span className="text-fg-3">Buying intent </span>
                  {dna.audience.buying_intent}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Breakdown and recent learnings */}
        {!isEmpty && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-5 space-y-6">
              <div>
                <SectionTitle title="Nodes by type" meta={`${graphData.edges.length} edges`} />
                <div className="card divide-y divide-line">
                  {COUNT_ROWS.map((row) => (
                    <div key={row.key} className="flex items-center justify-between px-4 h-10">
                      <span className="flex items-center gap-2 text-fg-2">
                        <span className="dot" aria-hidden="true" style={{ background: row.color }} />
                        {row.label}
                      </span>
                      <span className="num text-fg">{nodeCounts[row.key] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {topNodes.length > 0 && (
                <div>
                  <SectionTitle title="Highest confidence" />
                  <div className="card divide-y divide-line">
                    {topNodes.map((node) => (
                      <div key={node.id} className="flex items-center justify-between gap-4 px-4 h-10">
                        <span className="truncate text-fg">{node.label}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="meta">{Math.round((node.confidence || 0) * 100)}%</span>
                          <Meter value={node.confidence || 0} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="lg:col-span-7">
              <SectionTitle title="Recent learnings" meta={learnings.length ? String(learnings.length) : undefined} />
              {learnings.length === 0 ? (
                <div className="card">
                  <EmptyState
                    title="No learnings yet"
                    description="New insights appear here as the agents review your content."
                  />
                </div>
              ) : (
                <ul className="card divide-y divide-line">
                  {learnings.map((l) => (
                    <li key={l.id} className="p-4 space-y-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="font-medium text-fg">{l.title}</h3>
                        <span className="meta shrink-0">
                          {l.source_agent}
                          {formatDate(l.created_at) && ` · ${formatDate(l.created_at)}`}
                        </span>
                      </div>
                      <p className="text-[13px] text-fg-2">{l.insight}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
