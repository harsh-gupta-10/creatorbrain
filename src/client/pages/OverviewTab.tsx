import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RotateCw, ExternalLink, SquarePlay, Camera, FolderKanban } from 'lucide-react';
import { api, type ContentItem } from '../lib/api';
import type { Creator, Project, ShortLink, Lesson, GraphData, Learning } from '../../shared/types';
import {
  PageHeader,
  Stat,
  SectionTitle,
  EmptyState,
  ErrorNote,
  Meter,
  Spinner,
  ICON,
  formatCount,
  formatDate,
} from '../components/ui';

interface OverviewTabProps {
  creator: Creator | null;
  onNavigateTab: (tabId: string) => void;
  isSample?: boolean;
}

interface ContentStats {
  count: number;
  medianViews: number;
  avgTitleLength: number;
  uploadsPerMonth: number;
  topWords: string[];
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'not yet';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.round(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ creator, onNavigateTab, isSample }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [lastStudiedAt, setLastStudiedAt] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [restudying, setRestudying] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [content, proj, lnk, lsn, brain] = await Promise.allSettled([
      api.onboarding.getContent(),
      api.studio.getProjects(),
      api.links.getLinks(),
      api.learn.getLessons(),
      api.brain.getGraph(),
    ]);
    if (content.status === 'fulfilled') {
      setItems(content.value.items);
      setStats(content.value.stats);
      setLastStudiedAt(content.value.lastStudiedAt);
    }
    if (proj.status === 'fulfilled') setProjects(proj.value.projects || []);
    if (lnk.status === 'fulfilled') setLinks(lnk.value.links || []);
    if (lsn.status === 'fulfilled') setLessons(lsn.value.lessons || []);
    if (brain.status === 'fulfilled') {
      setGraph(brain.value.graph);
      setLearnings(brain.value.learnings || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const restudy = async () => {
    setError('');
    setRestudying(true);
    try {
      const { jobId } = await api.onboarding.startStudy();
      for (let i = 0; i < 4; i++) {
        const { job } = await api.onboarding.runStep(jobId);
        if (job.status === 'failed') throw new Error(job.error_message || 'The study stopped');
        if (job.status !== 'running') break;
      }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The study stopped');
    } finally {
      setRestudying(false);
    }
  };

  const totalClicks = links.reduce((a, l) => a + (l.total_clicks || 0), 0);
  const completed = lessons.filter((l) => l.completed).length;
  const insights = (graph?.nodes || [])
    .filter((n) => n.type === 'Strength' || n.type === 'Gap')
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'Strength' ? -1 : 1))
    .slice(0, 6);
  const topLinks = [...links].sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0)).slice(0, 5);
  const recentProjects = projects.slice(0, 5);

  if (loading) {
    return (
      <div className="py-24 flex justify-center text-fg-3">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          <>
            {creator?.channel_title || creator?.name}
            <span className="text-fg-3"> · studied {timeAgo(lastStudiedAt || creator?.last_studied_at)}</span>
          </>
        }
        actions={
          <>
            {!isSample && (
              <button className="btn btn-secondary" onClick={restudy} disabled={restudying}>
                {restudying ? <Spinner size={14} /> : <RotateCw {...ICON} />}
                {restudying ? 'Studying' : 'Study again'}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => onNavigateTab('studio')}>
              New video
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Median views"
          value={stats?.count ? formatCount(stats.medianViews) : '–'}
          note={stats?.count ? `Across your last ${stats.count} uploads` : 'No uploads studied yet'}
        />
        <Stat
          label="Uploads per month"
          value={stats?.count ? stats.uploadsPerMonth.toFixed(1) : '–'}
          note={creator?.upload_cadence ? `You aimed for ${cadenceLabel(creator.upload_cadence)}` : 'Based on publish dates'}
        />
        <Stat label="Short link clicks" value={formatCount(totalClicks)} note={`${links.length} active links`} />
        <Stat
          label="Lessons done"
          value={
            <>
              {completed}
              <span className="text-fg-3"> / {lessons.length}</span>
            </>
          }
          note="Planned from your gaps"
        />
      </div>

      {/* Main chart + insights */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <SectionTitle
            title="Views per upload"
            meta={stats?.count ? `median ${formatCount(stats.medianViews)}` : undefined}
          />
          {items.filter((i) => i.platform === 'youtube').length > 1 ? (
            <ViewsChart items={items.filter((i) => i.platform === 'youtube')} median={stats?.medianViews || 0} />
          ) : (
            <EmptyState
              icon={<SquarePlay {...ICON} />}
              title="No YouTube uploads yet"
              description="Add your channel in Settings and study again to see how each upload performs"
            />
          )}
        </div>

        <div className="card p-5">
          <SectionTitle
            title="What we learned"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('brain')}>
                Brain
                <ArrowRight {...ICON} />
              </button>
            }
          />
          {insights.length ? (
            <ul className="flex flex-col">
              {insights.map((n) => (
                <li key={n.id} className="py-3 border-t border-line first:border-t-0 first:pt-1">
                  <div className="flex items-center gap-2">
                    <span className={`dot ${n.type === 'Strength' ? 'bg-positive' : 'bg-negative'}`} />
                    <span className="text-[12px] text-fg-3">{n.type === 'Strength' ? 'Strength' : 'To work on'}</span>
                    <Meter value={n.confidence ?? 0.7} className="ml-auto" />
                  </div>
                  <div className="mt-1 text-[14px] text-fg leading-5">{n.label}</div>
                  {n.description && <div className="mt-[2px] text-[13px] text-fg-2 leading-5 line-clamp-2">{n.description}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-2 text-[13px]">Run a study to see strengths and gaps here</p>
          )}
        </div>
      </div>

      {/* Recent uploads */}
      <div className="mt-6 card">
        <div className="px-5 pt-5">
          <SectionTitle title="Recent content" meta={items.length ? `${items.length} studied` : undefined} />
        </div>
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12px] text-fg-3 border-b border-line">
                  <th className="font-normal px-5 py-2">Title</th>
                  <th className="font-normal px-5 py-2 w-24">Published</th>
                  <th className="font-normal px-5 py-2 w-24 text-right">Views</th>
                  <th className="font-normal px-5 py-2 w-32 text-right">Vs median</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 8).map((item) => {
                  const ratio = stats?.medianViews ? item.views / stats.medianViews : 0;
                  const pct = Math.round((ratio - 1) * 100);
                  return (
                    <tr key={item.id} className="border-b border-line last:border-b-0 hover:bg-raised/60 transition-colors">
                      <td className="px-5 py-3">
                        <a
                          href={item.url || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 min-w-0 group"
                        >
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt=""
                              loading="lazy"
                              className="w-[72px] h-[40px] rounded-[6px] object-cover bg-raised shrink-0"
                            />
                          ) : (
                            <span className="w-[72px] h-[40px] rounded-[6px] bg-raised shrink-0 flex items-center justify-center text-fg-3">
                              {item.platform === 'instagram' ? <Camera {...ICON} /> : <SquarePlay {...ICON} />}
                            </span>
                          )}
                          <span className="truncate text-fg group-hover:text-accent-ink transition-colors">{item.title}</span>
                        </a>
                      </td>
                      <td className="px-5 py-3 meta">{formatDate(item.published_at)}</td>
                      <td className="px-5 py-3 text-right num">{item.platform === 'youtube' ? formatCount(item.views) : '–'}</td>
                      <td
                        className={`px-5 py-3 text-right num text-[13px] ${
                          item.platform !== 'youtube' || !stats?.medianViews
                            ? 'text-fg-3'
                            : pct >= 0
                              ? 'text-positive'
                              : 'text-fg-2'
                        }`}
                      >
                        {item.platform === 'youtube' && stats?.medianViews ? `${pct >= 0 ? '+' : ''}${pct}%` : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<SquarePlay {...ICON} />}
            title="Nothing studied yet"
            description="Once we read your uploads they show up here, compared to your median"
          />
        )}
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <SectionTitle
            title="In production"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('studio')}>
                Studio
                <ArrowRight {...ICON} />
              </button>
            }
          />
          {recentProjects.length ? (
            <ul>
              {recentProjects.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 border-t border-line first:border-t-0">
                  <FolderKanban {...ICON} className="text-fg-3 shrink-0" />
                  <span className="truncate flex-1">{p.title}</span>
                  <span className="tag">{p.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-2">No videos in production. Start one from the Studio</p>
          )}
        </div>

        <div className="card p-5">
          <SectionTitle
            title="Top links"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('links')}>
                Short links
                <ArrowRight {...ICON} />
              </button>
            }
          />
          {topLinks.length ? (
            <ul>
              {topLinks.map((l) => {
                const max = topLinks[0]?.total_clicks || 1;
                return (
                  <li key={l.id} className="py-2 border-t border-line first:border-t-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[13px] truncate">/s/{l.slug}</span>
                      <span className="text-[13px] text-fg-2 truncate flex-1">{l.title || l.destination_domain}</span>
                      <span className="meta">{formatCount(l.total_clicks)}</span>
                      <a href={`/s/${l.slug}`} target="_blank" rel="noreferrer" className="text-fg-3 hover:text-fg" aria-label="Open link">
                        <ExternalLink size={14} strokeWidth={1.5} />
                      </a>
                    </div>
                    <div className="mt-2 h-[3px] rounded-full bg-raised overflow-hidden">
                      <div className="h-full bg-fg-3/60 rounded-full" style={{ width: `${((l.total_clicks || 0) / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-2">No short links yet</p>
          )}
        </div>
      </div>

      {learnings[0] && (
        <p className="mt-6 text-[13px] text-fg-3">
          Latest note from {learnings[0].source_agent}: <span className="text-fg-2">{learnings[0].insight}</span>
        </p>
      )}
    </div>
  );
};

function cadenceLabel(c: string): string {
  return { weekly: 'weekly', biweekly: 'every two weeks', monthly: 'monthly', irregular: 'no set rhythm' }[c] || c;
}

/** Views per upload, oldest to newest. The latest upload carries the accent, the rest stay neutral */
const ViewsChart: React.FC<{ items: ContentItem[]; median: number }> = ({ items, median }) => {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(
    () => [...items].sort((a, b) => (a.published_at || '').localeCompare(b.published_at || '')).slice(-15),
    [items]
  );
  const W = 720;
  const H = 280;
  const pad = { l: 48, r: 12, t: 12, b: 28 };
  const max = Math.max(...data.map((d) => d.views), median, 1);
  const niceMax = niceCeil(max);
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * niceMax);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Views per upload">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(23 23 23 / 0.06)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-fg-3" style={{ font: '11px var(--font-mono)' }}>
              {formatCount(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.2;
          const w = bw * 0.6;
          const isLast = i === data.length - 1;
          const top = y(d.views);
          return (
            <g key={d.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect
                x={x}
                y={top}
                width={w}
                height={Math.max(1, H - pad.b - top)}
                rx={3}
                fill={isLast ? '#2f5bea' : hover === i ? '#525252' : '#d4d4d8'}
                style={{ transition: 'fill 150ms' }}
              />
              {(i % Math.ceil(data.length / 6) === 0 || isLast) && (
                <text x={x + w / 2} y={H - 8} textAnchor="middle" className="fill-fg-3" style={{ font: '11px var(--font-mono)' }}>
                  {formatDate(d.published_at)}
                </text>
              )}
            </g>
          );
        })}
        {median > 0 && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(median)} y2={y(median)} stroke="#737373" strokeDasharray="3 4" />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-2 left-14 right-4 sm:right-auto sm:max-w-[360px] card px-3 py-2 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
          <div className="text-[13px] text-fg leading-5 line-clamp-2">{h.title}</div>
          <div className="meta mt-1">
            {formatDate(h.published_at)} · {h.views.toLocaleString('en-US')} views
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-[12px] text-fg-3">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px] bg-accent" /> Latest upload
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 border-t border-dashed border-fg-3" /> Median
        </span>
      </div>
    </div>
  );
};

function niceCeil(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}
