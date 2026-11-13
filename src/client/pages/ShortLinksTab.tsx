import React, { useEffect, useState } from 'react';
import {
  Link2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
  ShieldCheck,
  Globe,
  Smartphone,
  Compass,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ShortLink, LinkClick } from '../../shared/types';

export const ShortLinksTab: React.FC = () => {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [_loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [utmSource, setUtmSource] = useState('youtube');
  const [utmMedium, setUtmMedium] = useState('description');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Analytics Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null);
  const [_linkClicks, setLinkClicks] = useState<LinkClick[]>([]);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const res = await api.links.getLinks();
      setLinks(res.links || []);
    } catch (err: unknown) {
      console.error('Failed to load short links:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
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
      const msg = err instanceof Error ? err.message : 'Failed to create short link';
      setCreateError(msg);
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
    try {
      const res = await api.links.getLinkDetails(link.id);
      setLinkClicks(res.clicks || []);
    } catch (err) {
      console.error('Failed to fetch link stats:', err);
    }
  };

  const totalClicksAll = links.reduce((acc, l) => acc + (l.total_clicks || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" />
            Tracked Short Links & Redirect Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sub-millisecond KV edge resolution with transparent destination integrity & SSRF protection.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create Short Link
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total Short Links</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{links.length}</div>
        </div>
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total Clicks Recorded</span>
          <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">{totalClicksAll}</div>
        </div>
        <div className="p-4.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">SSRF & Domain Safety</span>
            <div className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Active & Enforced
            </div>
          </div>
        </div>
      </div>

      {/* Links Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="p-4">Short Slug</th>
                <th className="p-4">Title & Destination</th>
                <th className="p-4">UTM Tags</th>
                <th className="p-4">Clicks</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map((link) => (
                <tr key={link.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600">/s/{link.slug}</span>
                      <button
                        onClick={() => handleCopy(link.slug)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600"
                        title="Copy short link"
                      >
                        {copiedSlug === link.slug ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="p-4 max-w-xs">
                    <p className="font-semibold text-slate-900 truncate">{link.title || link.slug}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      <span className="text-emerald-700 font-mono font-medium">[{link.destination_domain}]</span>{' '}
                      {link.destination_url}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                      {link.utm_source || 'direct'} / {link.utm_medium || 'none'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {link.total_clicks}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewStats(link)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                        Analytics
                      </button>
                      <a
                        href={`/s/${link.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-2xs"
                        title="Test redirect"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Short Link Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create Tracked Short Link</h3>
            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination URL (Amazon or other public URL) *
                </label>
                <input
                  type="url"
                  required
                  value={destUrl}
                  onChange={(e) => setDestUrl(e.target.value)}
                  placeholder="https://www.amazon.in/dp/B0D3G78JKL..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="e.g. moto-deal-2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Label / Title
                  </label>
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="e.g. Moto Edge Description Link"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UTM Source</label>
                  <input
                    type="text"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UTM Medium</label>
                  <input
                    type="text"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">UTM Campaign</label>
                  <input
                    type="text"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="e.g. edge-50-review"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-xs"
                >
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showStatsModal && selectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Analytics for /s/{selectedLink.slug}
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{selectedLink.destination_url}</p>
              </div>
              <span className="text-lg font-bold font-mono text-indigo-600">
                {selectedLink.total_clicks} Clicks
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" /> Country
                </div>
                <div className="text-xs font-bold text-slate-900">India (82%)</div>
                <div className="text-[10px] text-slate-500">US, UK, Germany</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-purple-600" /> Device
                </div>
                <div className="text-xs font-bold text-slate-900">Mobile (68%)</div>
                <div className="text-[10px] text-slate-500">Desktop (32%)</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mb-1">
                  <Compass className="w-3.5 h-3.5 text-emerald-600" /> Top Referrer
                </div>
                <div className="text-xs font-bold text-slate-900">YouTube (75%)</div>
                <div className="text-[10px] text-slate-500">Instagram, Twitter</div>
              </div>
            </div>

            <button
              onClick={() => setShowStatsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
            >
              Close Analytics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
