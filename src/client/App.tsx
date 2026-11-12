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
import { MarketingLandingPage } from './pages/MarketingLandingPage';

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

  const [viewMode, setViewMode] = useState<'marketing' | 'app'>(() => {
    if (typeof window === 'undefined') return 'marketing';
    const path = window.location.pathname;
    if (path.startsWith('/@') || path.startsWith('/%40') || path === '/onboarding') {
      return 'app';
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') || params.get('app') === 'true') {
      return 'app';
    }
    return 'marketing';
  });

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
      setViewMode('app');
    }
  }, []);

  // Update query string on tab change
  const handleSelectTab = (tab: TabId) => {
    setActiveTab(tab);
    setViewMode('app');
    setShowOnboarding(false);
    setMobileMenuOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    url.searchParams.set('app', 'true');
    window.history.replaceState({}, '', url.toString());
  };

  const handleLaunchApp = (targetTab?: string) => {
    setViewMode('app');
    window.scrollTo(0, 0);
    if (targetTab && TABS.some((t) => t.id === targetTab)) {
      setActiveTab(targetTab as TabId);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', targetTab);
      url.searchParams.set('app', 'true');
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('app', 'true');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleGoToMarketing = () => {
    setViewMode('marketing');
    setShowOnboarding(false);
    window.scrollTo(0, 0);
    const url = new URL(window.location.href);
    url.searchParams.delete('app');
    url.searchParams.delete('tab');
    window.history.replaceState({}, '', url.pathname);
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
          setViewMode('app');
          window.location.reload();
        }}
      />
    );
  }

  // If marketing landing page requested
  if (viewMode === 'marketing') {
    return <MarketingLandingPage onLaunchApp={handleLaunchApp} />;
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 canvas-grid flex flex-col md:flex-row antialiased selection:bg-orange-500/20 selection:text-orange-950 relative">
      {/* Ambient Radial Background Glow */}
      <div className="ambient-glow" />

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white/95 border-r border-slate-200/90 flex flex-col transition-transform duration-200 backdrop-blur-2xl shadow-sm ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-white/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff5722] via-[#e11d48] to-[#9333ea] p-[1.5px] shadow-md shadow-orange-500/20">
              <div className="w-full h-full bg-white rounded-xl flex items-center justify-center text-base">
                🧠
              </div>
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
                CreatorBrain <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 rounded-full font-mono border border-orange-500/20 font-bold">OS</span>
              </div>
              <div className="text-[10px] text-slate-500">Agentic Creator Operating System</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-800 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Creator Profile Chip */}
        <div className="p-3 mx-3 my-2.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex items-center gap-3 shadow-xs">
          {creator?.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="w-9 h-9 rounded-full object-cover border border-orange-500/30 shadow-xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {creator?.name?.slice(0, 2) || 'KV'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1">
              {creator?.name || 'Kabir Verma'}
              <span className="text-emerald-500 text-[10px]" title="DNA Synced">●</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              @{creator?.handle || 'techkabir'} · {creator?.subscribers ? `${(creator.subscribers / 1000).toFixed(1)}k` : '7.5k'}
            </div>
          </div>
          {isDemo && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
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
                ? 'bg-gradient-to-r from-[#ff5722] via-[#e11d48] to-[#9333ea] border-transparent text-white shadow-md shadow-orange-500/20'
                : 'bg-gradient-to-r from-orange-50/80 to-purple-50/80 hover:from-orange-100/80 hover:to-purple-100/80 border-orange-200/70 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base group-hover:scale-110 transition-transform">💬</span>
              <div>
                <div className={`text-xs font-bold leading-tight ${activeTab === 'copilot' ? 'text-white' : 'text-slate-900'}`}>Brain Copilot</div>
                <div className={`text-[10px] ${activeTab === 'copilot' ? 'text-white/80' : 'text-slate-500'}`}>Chat & ideate freely</div>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              activeTab === 'copilot' ? 'bg-white/20 text-white' : 'bg-orange-500/15 text-orange-700 border border-orange-500/20'
            }`}>
              New
            </span>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4 text-xs">
          {/* Core Creation */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Creation
            </div>
            {TABS.filter((t) => t.category === 'core').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
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
                        : 'bg-slate-100 text-slate-600 border-slate-200'
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
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Monetization
            </div>
            {TABS.filter((t) => t.category === 'growth').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
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
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Intelligence
            </div>
            {TABS.filter((t) => t.category === 'intelligence').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
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
                        : 'bg-slate-100 text-slate-600 border-slate-200'
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
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              System
            </div>
            {TABS.filter((t) => t.category === 'system').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
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
        <div className="p-3 border-t border-slate-200/80 space-y-2 bg-white/60">
          <button
            onClick={handleGoToMarketing}
            className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
          >
            <span>🌐</span> View Marketing Site
          </button>
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <span>✨</span> Onboard New Channel
          </button>
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
            <span>Cloudflare Edge</span>
            <span>v1.2.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-slate-600 hover:text-slate-900 p-1"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {TABS.find((t) => t.id === activeTab)?.icon}
              </span>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>
          </div>

          {/* Quick Actions & Live Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleGoToMarketing}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <span>🌐</span>
              <span>Website</span>
            </button>

            {/* Quick Copilot Chat Button */}
            {activeTab !== 'copilot' && (
              <button
                onClick={() => handleSelectTab('copilot')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500/10 to-rose-500/10 hover:from-orange-500/15 hover:to-rose-500/15 border border-orange-300/60 text-orange-800 rounded-xl text-xs font-semibold transition shadow-xs"
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
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-mono transition shadow-xs"
            >
              <span>🌐</span> /@{creator?.handle || 'techkabir'}
            </a>

            {/* Run Autonomous Agents Trigger */}
            <button
              onClick={handleRunAgentsGlobal}
              disabled={runningAgents}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5 shadow-xs"
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
          <div className="bg-amber-50/80 border-b border-amber-200/70 px-4 py-1.5 text-[11px] text-amber-900 flex items-center gap-2 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-950 shrink-0">Orchestrator:</span>
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
