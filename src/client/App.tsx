import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import type { Creator } from '../shared/types';

// Tab Pages
import { OverviewTab } from './pages/OverviewTab';
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
  | 'studio'
  | 'bio'
  | 'links'
  | 'amazon'
  | 'brain'
  | 'learn'
  | 'assess'
  | 'tools'
  | 'agents'
  | 'settings';

interface TabItem {
  id: TabId;
  label: string;
  icon: string;
  badge?: string;
  category: 'core' | 'growth' | 'intelligence' | 'system';
}

const TABS: TabItem[] = [
  // Core Workflow
  { id: 'overview', label: 'Overview', icon: '📊', category: 'core' },
  { id: 'studio', label: 'Content Studio', icon: '🎬', badge: 'Hero', category: 'core' },
  { id: 'tools', label: 'Creative Tools', icon: '⚡', category: 'core' },

  // Growth & Monetization
  { id: 'bio', label: 'Link-in-Bio', icon: '📱', category: 'growth' },
  { id: 'links', label: 'Short Links', icon: '🔗', category: 'growth' },
  { id: 'amazon', label: 'Amazon Affiliate', icon: '📦', category: 'growth' },

  // Intelligence & DNA
  { id: 'brain', label: 'Brain Graph', icon: '🧠', badge: 'DNA', category: 'intelligence' },
  { id: 'learn', label: 'Learn & Coach', icon: '🎓', category: 'intelligence' },
  { id: 'assess', label: 'Skill Assessor', icon: '📝', category: 'intelligence' },
  { id: 'agents', label: 'Agent Fleet', icon: '🤖', badge: '13', category: 'intelligence' },

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
    if (path.startsWith('/@')) {
      // Direct bio page route handled by server or client
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col transition-transform duration-200 backdrop-blur-md ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/30">
              🧠
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                CreatorBrain <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-mono">OS</span>
              </div>
              <div className="text-[10px] text-slate-400">Agentic Creator OS</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Creator Info Card */}
        <div className="p-3 mx-3 my-2 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center gap-3">
          {creator?.avatar_url ? (
            <img
              src={creator.avatar_url}
              alt={creator.name}
              className="w-9 h-9 rounded-full object-cover border border-indigo-500/50"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center text-xs border border-indigo-500/50">
              {creator?.name?.slice(0, 2) || 'KV'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{creator?.name || 'Kabir Verma'}</div>
            <div className="text-[11px] text-slate-400 font-mono truncate">@{creator?.handle || 'techkabir'}</div>
          </div>
          {isDemo && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              DEMO
            </span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4 text-xs">
          {/* Core Section */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Creation
            </div>
            {TABS.filter((t) => t.category === 'core').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
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
            <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Monetization
            </div>
            {TABS.filter((t) => t.category === 'growth').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Intelligence */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Creator Intelligence
            </div>
            {TABS.filter((t) => t.category === 'intelligence').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* System */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Settings
            </div>
            {TABS.filter((t) => t.category === 'system').map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
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
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full py-1.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition flex items-center justify-center gap-2"
          >
            <span>✨</span> Onboard New Channel
          </button>
          <div className="flex items-center justify-between text-[10px] text-slate-500 px-1 font-mono">
            <span>Cloudflare Free Tier</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-1"
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
            {/* Live Bio Page preview button */}
            <a
              href={`/@${creator?.handle || 'techkabir'}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-mono transition"
            >
              <span>🌐</span> /@{creator?.handle || 'techkabir'}
            </a>

            {/* Run Autonomous Agents Trigger */}
            <button
              onClick={handleRunAgentsGlobal}
              disabled={runningAgents}
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <span className={runningAgents ? 'animate-spin' : ''}>🤖</span>
              <span className="hidden sm:inline">
                {runningAgents ? 'Agents Thinking...' : 'Trigger Agents'}
              </span>
            </button>
          </div>
        </header>

        {/* Dynamic Agent Broadcast Ticker */}
        {lastAgentAction && (
          <div className="bg-slate-900/60 border-b border-slate-800/50 px-4 py-1.5 text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-slate-300 shrink-0">Orchestrator:</span>
            <span className="truncate">{lastAgentAction}</span>
          </div>
        )}

        {/* Tab Content Render */}
        <div className="flex-1 pb-16">
          {activeTab === 'overview' && (
            <OverviewTab
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
