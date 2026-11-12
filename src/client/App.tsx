import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import type { Creator } from '../shared/types';

// Tab Pages
import { OverviewTab } from './pages/OverviewTab';
import { CopilotTab } from './pages/CopilotTab';
import { ContentStudioTab } from './pages/ContentStudioTab';
import { LinkInBioTab } from './pages/LinkInBioTab';
import { ShortLinksTab } from './pages/ShortLinksTab';
import { AmazonAffiliateTab } from './pages/AmazonAffiliateTab';
import { BrainTab } from './pages/BrainTab';
import { LearnTab } from './pages/LearnTab';
import { AssessTab } from './pages/AssessTab';
import { ToolsTab } from './pages/ToolsTab';
import { AgentsTab } from './pages/AgentsTab';
import { SettingsTab } from './pages/SettingsTab';
import { OnboardingPage } from './pages/OnboardingPage';
import { PublicBioPage } from './pages/PublicBioPage';

type TabId =
  | 'overview'
  | 'copilot'
  | 'studio'
  | 'tools'
  | 'bio'
  | 'links'
  | 'amazon'
  | 'brain'
  | 'learn'
  | 'assess'
  | 'agents'
  | 'settings';

interface TabItem {
  id: TabId;
  label: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
  category: 'core' | 'growth' | 'intelligence' | 'system';
}

const TABS: TabItem[] = [
  // Core Workflow & Copilot
  { id: 'overview', label: 'Dashboard', icon: '📊', category: 'core' },
  { id: 'copilot', label: 'Brain Copilot', icon: '💬', badge: 'AI Chat', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', category: 'core' },
  { id: 'studio', label: 'Content Studio', icon: '🎬', badge: 'Hero', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40', category: 'core' },
  { id: 'tools', label: 'Creative Tools', icon: '⚡', category: 'core' },

  // Growth & Monetization
  { id: 'bio', label: 'Link-in-Bio', icon: '📱', category: 'growth' },
  { id: 'links', label: 'Short Links', icon: '🔗', category: 'growth' },
  { id: 'amazon', label: 'Amazon Affiliate', icon: '📦', category: 'growth' },

  // Intelligence & DNA
  { id: 'brain', label: 'Brain Graph', icon: '🧠', badge: 'DNA', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40', category: 'intelligence' },
  { id: 'learn', label: 'Learn & Coach', icon: '🎓', category: 'intelligence' },
  { id: 'assess', label: 'Skill Assessor', icon: '📝', category: 'intelligence' },
  { id: 'agents', label: 'Agent Fleet', icon: '🤖', badge: '13', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', category: 'intelligence' },

  // Settings
  { id: 'settings', label: 'Settings', icon: '⚙️', category: 'system' },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [runningAgents, setRunningAgents] = useState(false);
  const [lastAgentAction, setLastAgentAction] = useState<string>('Autonomous cron running hourly');

  // Handle URL path inspection (e.g. /@handle or ?tab=studio)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/@') || path.startsWith('/%40')) {
      return;
    }
    if (path === '/onboarding') {
      setShowOnboarding(true);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as TabId;
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Update query string on tab change
  const handleSelectTab = (tab: TabId) => {
    setActiveTab(tab);
    setShowOnboarding(false);
    setMobileMenuOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  // Fetch current session
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.auth.me();
        if (res.creator) {
          setCreator(res.creator);
          setIsDemo(res.isDemo);
        } else {
          // Default to demo creator
          const demoRes = await api.auth.demo();
          setCreator(demoRes.creator);
          setIsDemo(true);
        }
      } catch (err) {
        console.error('Failed to get session creator', err);
      }
    };
    fetchMe();
  }, []);

  const handleRunAgentsGlobal = async () => {
    try {
      setRunningAgents(true);
      const res = await api.agents.runNow();
      if (res.nextBestAction) {
        setLastAgentAction(res.nextBestAction);
      }
    } catch (err) {
      console.error('Agent trigger failed', err);
    } finally {
      setRunningAgents(false);
    }
  };

  // If path is /@:handle directly and SSR didn't take over:
  if (
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/@') || window.location.pathname.startsWith('/%40'))
  ) {
    const handle = decodeURIComponent(window.location.pathname).replace(/^\/@/, '');
    return <PublicBioPage handle={handle} />;
  }

  // If onboarding requested
  if (showOnboarding) {
    return (
      <OnboardingPage
        onComplete={() => {
          setShowOnboarding(false);
          setActiveTab('overview');
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#05070e] text-slate-100 flex flex-col md:flex-row antialiased selection:bg-indigo-500/30 selection:text-indigo-200 relative">
      {/* Ambient Radial Background Glow */}
      <div className="ambient-glow" />

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-[#080b16]/90 border-r border-white/[0.08] flex flex-col transition-transform duration-200 backdrop-blur-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#080b16] rounded-xl flex items-center justify-center text-base">
                🧠
              </div>
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                CreatorBrain <span className="text-[9px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full font-mono border border-indigo-500/30">OS</span>
              </div>
              <div className="text-[10px] text-zinc-400">Agentic Creator Operating System</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-zinc-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Creator Profile Chip */}
        <div className="p-3 mx-3 my-2.5 rounded-xl bg-zinc-900/60 border border-white/[0.07] flex items-center gap-3 backdrop-blur-md">
          {creator?.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="w-9 h-9 rounded-full object-cover border border-indigo-500/40 shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
              {creator?.name?.slice(0, 2) || 'KV'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
              {creator?.name || 'Kabir Verma'}
              <span className="text-emerald-400 text-[10px]" title="DNA Synced">●</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono truncate">
              @{creator?.handle || 'techkabir'} · {creator?.subscribers ? `${(creator.subscribers / 1000).toFixed(1)}k` : '7.5k'}
            </div>
          </div>
          {isDemo && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              DEMO
            </span>
          )}
        </div>

        {/* Quick Launch Copilot Banner */}
        <div className="px-3 mb-2">
          <button
            onClick={() => handleSelectTab('copilot')}
            className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between group ${
              activeTab === 'copilot'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400/40 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-indigo-950/30 hover:bg-indigo-950/50 border-indigo-500/30 text-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base group-hover:scale-110 transition-transform">💬</span>
              <div>
                <div className="text-xs font-bold leading-tight">Brain Copilot</div>
                <div className="text-[10px] text-indigo-300/80">Chat & ideate freely</div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200">
              New
            </span>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4 text-xs">
          {/* Core Creation */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Creation
            </div>
            {TABS.filter((t) => t.category === 'core').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 border border-indigo-400/20'
                    : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white border-white/20'
                        : tab.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Growth & Monetization */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Monetization
            </div>
            {TABS.filter((t) => t.category === 'growth').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 border border-indigo-400/20'
                    : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Creator Intelligence */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Intelligence
            </div>
            {TABS.filter((t) => t.category === 'intelligence').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 border border-indigo-400/20'
                    : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white border-white/20'
                        : tab.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* System Settings */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              System
            </div>
            {TABS.filter((t) => t.category === 'system').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/25 border border-indigo-400/20'
                    : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <span>✨</span> Onboard New Channel
          </button>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 font-mono">
            <span>Cloudflare Edge</span>
            <span>v1.2.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-[#080b16]/85 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-zinc-400 hover:text-white p-1"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {TABS.find((t) => t.id === activeTab)?.icon}
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>
          </div>

          {/* Quick Actions & Live Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Copilot Chat Button */}
            {activeTab !== 'copilot' && (
              <button
                onClick={() => handleSelectTab('copilot')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/40 hover:to-purple-600/40 border border-indigo-500/40 text-indigo-200 rounded-xl text-xs font-semibold transition shadow-sm"
              >
                <span>💬</span>
                <span className="hidden sm:inline">Ask Copilot</span>
              </button>
            )}

            {/* Live Bio Page preview button */}
            <a
              href={`/@${creator?.handle || 'techkabir'}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 rounded-xl text-xs font-mono transition"
            >
              <span>🌐</span> /@{creator?.handle || 'techkabir'}
            </a>

            {/* Run Autonomous Agents Trigger */}
            <button
              onClick={handleRunAgentsGlobal}
              disabled={runningAgents}
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
            >
              <span className={runningAgents ? 'animate-spin' : ''}>🤖</span>
              <span className="hidden sm:inline">
                {runningAgents ? 'Thinking...' : 'Trigger Agents'}
              </span>
            </button>
          </div>
        </header>

        {/* Dynamic Agent Broadcast Ticker */}
        {lastAgentAction && (
          <div className="bg-zinc-950/70 border-b border-white/[0.05] px-4 py-1.5 text-[11px] text-zinc-400 flex items-center gap-2 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-zinc-300 shrink-0">Orchestrator:</span>
            <span className="truncate">{lastAgentAction}</span>
          </div>
        )}

        {/* Tab Content Render */}
        <div className={`flex-1 w-full pb-16 ${activeTab === 'copilot' ? 'p-3 sm:p-5 max-w-6xl mx-auto' : 'p-4 md:p-6 lg:p-8 max-w-7xl mx-auto'}`}>
          {activeTab === 'overview' && (
            <OverviewTab
              creator={creator}
              onNavigateTab={(tab) => handleSelectTab(tab as TabId)}
            />
          )}
          {activeTab === 'copilot' && (
            <CopilotTab
              creator={creator}
              onNavigateTab={(tab) => handleSelectTab(tab as TabId)}
            />
          )}
          {activeTab === 'studio' && <ContentStudioTab />}
          {activeTab === 'tools' && <ToolsTab />}
          {activeTab === 'bio' && <LinkInBioTab />}
          {activeTab === 'links' && <ShortLinksTab />}
          {activeTab === 'amazon' && <AmazonAffiliateTab />}
          {activeTab === 'brain' && <BrainTab />}
          {activeTab === 'learn' && <LearnTab />}
          {activeTab === 'assess' && <AssessTab />}
          {activeTab === 'agents' && <AgentsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
};
