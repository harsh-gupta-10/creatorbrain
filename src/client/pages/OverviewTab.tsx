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
  MessageSquare,
  Bot,
  Zap,
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
    } catch (err: unknown) {
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
    <div className="space-y-8 animate-in fade-in duration-300 w-full">
      {/* Top Banner: Creator Greeting & Next Best Action */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-r from-[#0d1222]/90 via-[#0e1628]/95 to-[#16122c]/80 p-6 md:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Autonomous Agent Orchestration Active
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {creator?.name || 'Creator'} 👋
            </h1>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
              <span className="font-semibold text-indigo-300">Today's Next Best Action:</span>{' '}
              <span className="text-slate-200">{nextBestAction}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateTab('copilot')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-95 border border-indigo-400/30"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with Copilot
            </button>
            <button
              onClick={() => onNavigateTab('studio')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.12] text-white font-semibold text-sm transition active:scale-95"
            >
              <FolderKanban className="w-4 h-4 text-cyan-400" />
              Content Studio
            </button>
            <button
              onClick={() => onNavigateTab('agents')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-semibold text-sm transition active:scale-95"
              title="Agent Timeline"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Brain Copilot Idea Station Feature Card */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden border border-indigo-500/20">
        <div className="absolute top-0 right-1/4 -mt-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Brain Copilot Idea Studio
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Grounded in Creator DNA
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Describe any video idea in natural language. Copilot analyzes your speaking tone, YouTube pacing, knowledge gaps, and live Amazon gear catalog to shape your next hit video.
            </p>
          </div>

          {/* Quick Idea Starter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateTab('copilot')}
              className="glass-pill px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5 text-left border border-white/[0.08]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Moto Edge vs Vivo V40</span>
            </button>
            <button
              onClick={() => onNavigateTab('copilot')}
              className="glass-pill px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5 text-left border border-white/[0.08]"
            >
              <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Fix Minute-4 Dropoff</span>
            </button>
            <button
              onClick={() => onNavigateTab('copilot')}
              className="glass-pill px-3 py-1.5 rounded-xl text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1.5 text-left border border-indigo-500/30 bg-indigo-500/10"
            >
              <span>Explore all prompts</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Projects */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Projects
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {activeProjects.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">in pipeline</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {projects.length} total projects across studio
          </p>
        </div>

        {/* Metric 2: Tracked Link Clicks */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tracked Link Clicks
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {totalClicks.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-500/90 font-medium">total clicks</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Across {links.length} active short & affiliate links
          </p>
        </div>

        {/* Metric 3: Learning Progress */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Learning Mastery
            </span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/25">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-300 font-mono tracking-tight">
              {learningPercent}%
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {completedLessons}/{lessons.length} done
            </span>
          </div>
          <div className="w-full bg-white/[0.06] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${learningPercent}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Subscribers & Channel */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Subscribers
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {(creator?.subscribers || 7520).toLocaleString()}
            </span>
            <span className="text-xs text-cyan-400 font-medium">YouTube</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 truncate">
            {creator?.niche || 'Tech & Hardware Reviews'}
          </p>
        </div>
      </div>

      {/* Two Column Layout: Recent Projects & Latest Brain Learnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Active Video Projects */}
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-cyan-400" />
              Active Video Projects
            </h2>
            <button
              onClick={() => onNavigateTab('studio')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition"
            >
              Open Studio <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {projects.slice(0, 3).map((p) => (
              <div
                key={p.id}
                onClick={() => onNavigateTab('studio')}
                className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-cyan-500/30 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition">
                    {p.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                      p.status === 'Published'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : p.status === 'Scripted'
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
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
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Latest Brain Learnings
            </h2>
            <button
              onClick={() => onNavigateTab('brain')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1 transition"
            >
              View Brain Graph <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {learnings.slice(0, 3).map((l) => (
              <div
                key={l.id}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{l.title}</span>
                  <span className="text-[10px] font-mono text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25">
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
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-emerald-400" />
            Top Performing Tracked Links
          </h2>
          <button
            onClick={() => onNavigateTab('links')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 transition"
          >
            Manage All Links <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {links.slice(0, 3).map((link) => (
            <div
              key={link.id}
              className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/30 transition flex flex-col justify-between"
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
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                <span>UTM: {link.utm_source || 'direct'}</span>
                <a
                  href={`/s/${link.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 inline-flex items-center gap-1 transition"
                >
                  Test Link <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
