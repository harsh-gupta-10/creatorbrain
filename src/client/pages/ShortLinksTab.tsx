import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Plus, Copy, Check, ExternalLink, BarChart3, ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api';
import type { ShortLink, LinkClick } from '../../shared/types';
import { ICON, PageHeader, Stat, SectionTitle, EmptyState, ErrorNote, Spinner, Dialog, formatCount } from '../components/ui';

const errMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Share of clicks per value, sorted, top N */
function breakdown(clicks: LinkClick[], key: 'country' | 'device' | 'referrer', top = 4) {
  const counts = new Map<string, number>();
  for (const c of clicks) {
    let v = (c[key] || 'Unknown').trim() || 'Unknown';
    if (key === 'referrer' && /^https?:\/\//i.test(v)) {
      try {
        v = new URL(v).hostname.replace(/^www\./, '');
      } catch {
        // keep raw value
      }
    }
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const total = clicks.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, count]) => ({ label, count, share: count / total }));
}

/** Clicks per day for the last `days` days, oldest first */
function dailySeries(clicks: LinkClick[], days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    return { date: d, count: 0 };
  });
  for (const c of clicks) {
    const d = new Date(c.created_at);
    if (Number.isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((d.getTime() - buckets[0].date.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days) buckets[idx].count += 1;
  }
  return buckets;
}

const ClicksChart: React.FC<{ clicks: LinkClick[] }> = ({ clicks }) => {
  const series = dailySeries(clicks);
  const max = Math.max(4, ...series.map((s) => s.count));
  const ticks = [max, Math.round(max / 2), 0];
  const chartH = 140;

  const total = series.reduce((a, s) => a + s.count, 0);
  const label = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <figure className="flex gap-3">
      <figcaption className="sr-only">
        Clicks per day for the last 14 days: {total} in total, {series[series.length - 1].count} today.
      </figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Clicks</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s, i) => (
            <tr key={i}>
              <th scope="row">{label(s.date)}</th>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col justify-between text-right meta !leading-none w-6" style={{ height: chartH }} aria-hidden="true">
        {ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="relative" style={{ height: chartH }}>
          {[0, 0.5, 1].map((p) => (
            <div key={p} className="absolute inset-x-0 border-t border-line" style={{ top: `${p * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1">
            {series.map((s, i) => {
              const isToday = i === series.length - 1;
              return (
                <div key={i} className="flex-1 h-full flex items-end" title={`${s.count} clicks`}>
                  <div
                    className={`w-full rounded-t-[2px] ${isToday ? 'bg-accent' : 'bg-line-strong'}`}
                    style={{ height: s.count ? `${Math.max(2, (s.count / max) * 100)}%` : 0 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-2 meta">
          <span>{series[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>Today</span>
        </div>
      </div>
    </figure>
  );
};

const RankedList: React.FC<{ title: string; rows: { label: string; count: number; share: number }[] }> = ({
  title,
  rows,
}) => (
  <div>
    <h3 className="text-[13px] text-fg-2 mb-2">{title}</h3>
    {rows.length === 0 ? (
      <div className="meta">No clicks yet</div>
    ) : (
      <ul className="space-y-2" aria-label={title}>
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="truncate text-fg">{r.label}</span>
              <span className="meta">{Math.round(r.share * 100)}%</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-raised" aria-hidden="true">
              <div className="h-1 rounded-full bg-fg-3" style={{ width: `${r.share * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const ShortLinksTab: React.FC = () => {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [utmSource, setUtmSource] = useState('youtube');
  const [utmMedium, setUtmMedium] = useState('description');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Analytics modal state
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.links.getLinks();
      setLinks(res.links || []);
    } catch (err: unknown) {
      setLoadError(errMessage(err, 'Could not load short links'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await api.links.createLink({
        destination_url: destUrl.trim(),
        slug: customSlug.trim() || undefined,
        title: linkTitle.trim() || undefined,
        utm_source: utmSource.trim() || undefined,
        utm_medium: utmMedium.trim() || undefined,
        utm_campaign: utmCampaign.trim() || undefined,
      });

      setShowCreateModal(false);
      setDestUrl('');
      setCustomSlug('');
      setLinkTitle('');
      await loadLinks();
    } catch (err: unknown) {
      setCreateError(errMessage(err, 'Could not create the short link'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (slug: string) => {
    const full = `${window.location.origin}/s/${slug}`;
    navigator.clipboard.writeText(full);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleViewStats = async (link: ShortLink) => {
    setSelectedLink(link);
    setShowStatsModal(true);
    setLinkClicks([]);
    setStatsError(null);
    setStatsLoading(true);
    try {
      const res = await api.links.getLinkDetails(link.id);
      setLinkClicks(res.clicks || []);
    } catch (err) {
      setStatsError(errMessage(err, 'Could not load analytics for this link'));
    } finally {
      setStatsLoading(false);
    }
  };

  const totalClicksAll = links.reduce((acc, l) => acc + (l.total_clicks || 0), 0);
  const avgClicks = links.length ? Math.round(totalClicksAll / links.length) : 0;
  const topLink = useMemo(
    () => [...links].sort((a, b) => (b.total_clicks || 0) - (a.total_clicks || 0))[0],
    [links]
  );

  const countries = useMemo(() => breakdown(linkClicks, 'country'), [linkClicks]);
  const devices = useMemo(() => breakdown(linkClicks, 'device'), [linkClicks]);
  const referrers = useMemo(() => breakdown(linkClicks, 'referrer'), [linkClicks]);

  return (
    <div>
      <PageHeader
        title="Short links"
        description="Tracked redirects for descriptions and captions. Each click records country, device and referrer."
        actions={
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus {...ICON} />
            New short link
          </button>
        }
      />

      {loadError && (
        <div className="mb-6">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <Stat label="Links" value={formatCount(links.length)} />
        <Stat label="Clicks recorded" value={formatCount(totalClicksAll)} note="All time, across every link" />
        <Stat
          label="Clicks per link"
          value={formatCount(avgClicks)}
          note={topLink ? `Most clicked: /s/${topLink.slug}` : undefined}
        />
      </div>
      <div className="flex items-center gap-2 text-[13px] text-fg-3 mb-8">
        <ShieldCheck {...ICON} className="text-fg-3 shrink-0" />
        Destinations are checked before each redirect. Private networks and unsafe hosts are blocked.
      </div>

      <SectionTitle title="All links" meta={links.length ? links.length : undefined} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-fg-3" role="status">
            <Spinner />
            Loading links
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 {...ICON} />}
            title="No short links yet"
            description="Create one for a video description or bio, then watch where the clicks come from."
            action={
              <button onClick={() => setShowCreateModal(true)} className="btn btn-secondary btn-sm">
                <Plus {...ICON} />
                New short link
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-fg-3 border-b border-line">
                <tr>
                  <th scope="col" className="px-4 h-10 font-normal">Short link</th>
                  <th scope="col" className="px-4 h-10 font-normal">Title and destination</th>
                  <th scope="col" className="px-4 h-10 font-normal">UTM</th>
                  <th scope="col" className="px-4 h-10 font-normal text-right">Clicks</th>
                  <th scope="col" className="px-4 h-10 font-normal text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-page transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-fg">/s/{link.slug}</span>
                        <button
                          onClick={() => handleCopy(link.slug)}
                          className="btn btn-ghost btn-sm !h-7 !px-2"
                          title="Copy short link"
                          aria-label={copiedSlug === link.slug ? `Copied /s/${link.slug}` : `Copy short link /s/${link.slug}`}
                        >
                          {copiedSlug === link.slug ? (
                            <Check {...ICON} className="text-positive" />
                          ) : (
                            <Copy {...ICON} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-fg truncate">{link.title || link.slug}</p>
                      <p className="text-[12px] leading-4 text-fg-3 truncate mt-1">
                        <span className="text-fg-2">{link.destination_domain}</span> · {link.destination_url}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="tag font-mono">
                        {link.utm_source || 'direct'} / {link.utm_medium || 'none'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono num text-fg">{formatCount(link.total_clicks)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewStats(link)} className="btn btn-secondary btn-sm">
                          <BarChart3 {...ICON} className="text-fg-2" />
                          Analytics<span className="sr-only"> for /s/{link.slug}</span>
                        </button>
                        <a
                          href={`/s/${link.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm !px-2"
                          title="Test redirect"
                          aria-label={`Test redirect for /s/${link.slug} (opens in a new tab)`}
                        >
                          <ExternalLink {...ICON} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create short link */}
      {showCreateModal && (
        <Dialog onClose={() => setShowCreateModal(false)} labelledBy="create-link-title" className="panel w-full max-w-lg p-6" backdropClassName="bg-black/30">
            <div className="flex items-center justify-between mb-4">
              <h2 id="create-link-title" className="text-[15px] font-medium text-fg">
                New short link
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost btn-sm !px-2"
                aria-label="Close"
              >
                <X {...ICON} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <ErrorNote>{createError}</ErrorNote>}

              <div>
                <label className="field-label" htmlFor="sl-dest">
                  Destination URL
                </label>
                <input
                  id="sl-dest"
                  type="url"
                  required
                  aria-describedby="sl-dest-hint"
                  value={destUrl}
                  onChange={(e) => setDestUrl(e.target.value)}
                  placeholder="https://www.amazon.in/dp/B0D3G78JKL"
                  className="input"
                />
                <p id="sl-dest-hint" className="field-hint">Any public URL, including Amazon product pages</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="sl-slug">
                    Slug <span className="text-fg-3 font-normal">optional</span>
                  </label>
                  <input
                    id="sl-slug"
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="edge-50-review"
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="sl-title">
                    Label
                  </label>
                  <input
                    id="sl-title"
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Edge 50 review description"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="field-label" htmlFor="sl-src">
                    UTM source
                  </label>
                  <input
                    id="sl-src"
                    type="text"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="sl-med">
                    UTM medium
                  </label>
                  <input
                    id="sl-med"
                    type="text"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="sl-camp">
                    UTM campaign
                  </label>
                  <input
                    id="sl-camp"
                    type="text"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="edge-50"
                    className="input font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={creating} aria-busy={creating} className="btn btn-primary">
                  {creating && <Spinner />}
                  Create link
                </button>
              </div>
            </form>
        </Dialog>
      )}

      {/* Link analytics */}
      {showStatsModal && selectedLink && (
        <Dialog onClose={() => setShowStatsModal(false)} labelledBy="stats-title" className="panel w-full max-w-2xl p-6" backdropClassName="bg-black/30">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <h2 id="stats-title" className="text-[15px] font-medium text-fg">
                  <span className="sr-only">Analytics for </span>
                  <span className="font-mono">/s/{selectedLink.slug}</span>
                </h2>
                <p className="text-[13px] text-fg-3 truncate mt-1">{selectedLink.destination_url}</p>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="btn btn-ghost btn-sm !px-2 shrink-0"
                aria-label="Close analytics"
              >
                <X {...ICON} />
              </button>
            </div>

            {statsError && (
              <div className="mb-4">
                <ErrorNote>{statsError}</ErrorNote>
              </div>
            )}

            <div className="flex items-baseline justify-between mb-4">
              <div className="text-[13px] text-fg-2">Clicks per day, last 14 days</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] leading-8 font-medium num text-fg">
                  {formatCount(selectedLink.total_clicks)}
                </span>
                <span className="meta">all time</span>
              </div>
            </div>

            {statsLoading ? (
              <div className="flex items-center justify-center gap-2 h-40 text-fg-3" role="status">
                <Spinner />
                Loading clicks
              </div>
            ) : (
              <ClicksChart clicks={linkClicks} />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 pt-6 border-t border-line">
              <RankedList title="Country" rows={countries} />
              <RankedList title="Device" rows={devices} />
              <RankedList title="Referrer" rows={referrers} />
            </div>
        </Dialog>
      )}
    </div>
  );
};
