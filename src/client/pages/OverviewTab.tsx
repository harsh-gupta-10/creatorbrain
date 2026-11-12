import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  BookOpen,
  FolderKanban,
  MousePointerClick,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Creator, Project, ShortLink, Lesson, Learning } from '../../shared/types';

interface OverviewTabProps {
  creator: Creator | null;
  onNavigateTab: (tabId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ creator, onNavigateTab }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [nextBestAction] = useState<string>(
    'Record a 45-second teardown Short for Motorola Edge 50 Fusion to recapture lost student viewers from the minute-4 dip.'
  );
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [projRes, linkRes, learnRes, brainRes] = await Promise.all([
        api.studio.getProjects(),
        api.links.getLinks(),
        api.learn.getLessons(),
        api.brain.getGraph(),
      ]);
      setProjects(projRes.projects || []);
      setLinks(linkRes.links || []);
      setLessons(learnRes.lessons || []);
      setLearnings(brainRes.learnings || []);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalClicks = links.reduce((acc, l) => acc + (l.total_clicks || 0), 0);
  const completedLessons = lessons.filter((l) => l.completed === 1).length;
  const learningPercent = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0;
  const activeProjects = projects.filter((p) => p.status !== 'Published');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner: Creator Greeting & Next Best Action */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Autonomous Agent Orchestration Active
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {creator?.name || 'Creator'} 👋
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
              <span className="font-semibold text-cyan-300">Today's Next Best Action:</span> {nextBestAction}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('studio')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/25 active:scale-95"
            >
              Open Content Studio
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigateTab('agents')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-semibold text-sm hover:bg-slate-700 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Timeline
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Projects</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{activeProjects.length}</span>
            <span className="text-xs text-slate-400">in progress</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {projects.length} total projects in studio
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tracked Link Clicks</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400 font-mono">{totalClicks.toLocaleString()}</span>
            <span className="text-xs text-emerald-500/90 font-medium">clicks</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Across {links.length} active short links
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Learning Progress</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-purple-300 font-mono">{learningPercent}%</span>
            <span className="text-xs text-slate-400 font-medium">{completedLessons}/{lessons.length} done</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${learningPercent}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subscribers</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">
              {(creator?.subscribers || 7520).toLocaleString()}
            </span>
            <span className="text-xs text-cyan-400 font-medium">YouTube</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {creator?.niche || 'Tech & Hardware'}
          </p>
        </div>
      </div>

      {/* Two Column Layout: Recent Projects & Latest Brain Learnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Active Video Projects */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-cyan-400" />
              Active Video Projects
            </h2>
            <button
              onClick={() => onNavigateTab('studio')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1"
            >
              View Board <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {projects.slice(0, 3).map((p) => (
              <div
                key={p.id}
                onClick={() => onNavigateTab('studio')}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200 group-hover:text-cyan-300 transition">
                    {p.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                      p.status === 'Published'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : p.status === 'Scripted'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {p.brief}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Latest Autonomous Brain Learnings */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Latest Brain Learnings
            </h2>
            <button
              onClick={() => onNavigateTab('brain')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
            >
              Open Graph <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {learnings.slice(0, 3).map((l) => (
              <div
                key={l.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{l.title}</span>
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

      {/* Top Short Links Row */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-emerald-400" />
            Top Performing Tracked Links
          </h2>
          <button
            onClick={() => onNavigateTab('links')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
          >
            Manage All Links <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {links.slice(0, 3).map((link) => (
            <div
              key={link.id}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-cyan-400 truncate">
                    /{link.slug}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {link.total_clicks} clicks
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium truncate">{link.title || link.slug}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{link.destination_domain}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>UTM: {link.utm_source || 'direct'}</span>
                <a
                  href={`/s/${link.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 inline-flex items-center gap-1"
                >
                  Test <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
