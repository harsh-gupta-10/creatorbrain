import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Clapperboard,
  Wand2,
  Link2,
  Link,
  ShoppingBag,
  Handshake,
  Network,
  Library,
  GraduationCap,
  ClipboardCheck,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from './lib/api';
import { navigate, usePath, linkProps } from './lib/router';
import type { Creator } from '../shared/types';
import { Logo, Spinner, ICON, SkipLink } from './components/ui';

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
import { AuthPage } from './pages/AuthPage';
import { LibraryTab } from './pages/LibraryTab';
import { StudyBanner } from './components/StudyBanner';
import { resetScriptLanguageCache } from './components/ScriptLanguagePicker';
import { DealsTab } from './pages/DealsTab';
import { AuditPage } from './pages/AuditPage';

type TabId =
  | 'overview'
  | 'copilot'
  | 'studio'
  | 'tools'
  | 'bio'
  | 'links'
  | 'amazon'
  | 'deals'
  | 'library'
  | 'brain'
  | 'learn'
  | 'assess'
  | 'agents'
  | 'settings';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  group: 'Create' | 'Earn' | 'Brain';
}

const TABS: TabItem[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, group: 'Create' },
  { id: 'copilot', label: 'Copilot', icon: MessageSquare, group: 'Create' },
  { id: 'studio', label: 'Studio', icon: Clapperboard, group: 'Create' },
  { id: 'tools', label: 'Quick tools', icon: Wand2, group: 'Create' },
  { id: 'bio', label: 'Link in bio', icon: Link2, group: 'Earn' },
  { id: 'links', label: 'Short links', icon: Link, group: 'Earn' },
  { id: 'amazon', label: 'Amazon', icon: ShoppingBag, group: 'Earn' },
  { id: 'deals', label: 'Brand deals', icon: Handshake, group: 'Earn' },
  { id: 'library', label: 'Library', icon: Library, group: 'Brain' },
  { id: 'brain', label: 'Brain', icon: Network, group: 'Brain' },
  { id: 'learn', label: 'Lessons', icon: GraduationCap, group: 'Brain' },
  { id: 'assess', label: 'Assessments', icon: ClipboardCheck, group: 'Brain' },
  { id: 'agents', label: 'Agents', icon: Bot, group: 'Brain' },
];

const ALL_TAB_IDS: TabId[] = [...TABS.map((t) => t.id), 'settings'];

interface Session {
  loading: boolean;
  creator: Creator | null;
  isSample: boolean;
}

export const App: React.FC = () => {
  const path = usePath();
  const [session, setSession] = useState<Session>({ loading: true, creator: null, isSample: false });

  const refreshSession = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setSession({ loading: false, creator: res.creator, isSample: res.isSample });
      return res;
    } catch {
      setSession({ loading: false, creator: null, isSample: false });
      return null;
    }
  }, []);

  useEffect(() => {
    // Old links used ?tab=studio&app=true
    const params = new URLSearchParams(window.location.search);
    const legacyTab = params.get('tab');
    if (legacyTab && ALL_TAB_IDS.includes(legacyTab as TabId)) {
      navigate(`/app/${legacyTab}`, { replace: true });
    }
    refreshSession();
  }, [refreshSession]);

  // Public creator page
  if (path.startsWith('/@') || path.startsWith('/%40')) {
    const handle = decodeURIComponent(path).replace(/^\/@/, '');
    return <PublicBioPage handle={handle} />;
  }

  if (path === '/audit') {
    return <AuditPage session={session} />;
  }

  if (path === '/login' || path === '/signup') {
    return <AuthPage mode={path === '/signup' ? 'signup' : 'login'} session={session} onAuthed={refreshSession} />;
  }

  if (path === '/onboarding' || path.startsWith('/app')) {
    if (session.loading) return <FullPageLoader />;
    if (!session.creator) {
      return <Redirect to='/login' />;
    }
    // Only the setup questions gate the app; the channel study itself runs inside the app
    const needsSetup = session.creator.onboarding_status === 'profile' && !session.isSample;
    if (path === '/onboarding') {
      if (!needsSetup) {
        return <Redirect to='/app' />;
      }
      return <OnboardingPage creator={session.creator} onComplete={async () => {
        await refreshSession();
        navigate('/app', { replace: true });
      }} />;
    }
    if (needsSetup) {
      return <Redirect to='/onboarding' />;
    }
    const tabId = (path.split('/')[2] || 'overview') as TabId;
    const activeTab = ALL_TAB_IDS.includes(tabId) ? tabId : 'overview';
    return (
      <AppShell
        activeTab={activeTab}
        creator={session.creator}
        isSample={session.isSample}
        onSessionChanged={refreshSession}
        onSignOut={async () => {
          await api.auth.logout().catch(() => {});
          resetScriptLanguageCache();
          setSession({ loading: false, creator: null, isSample: false });
          navigate('/');
        }}
      />
    );
  }

  return <MarketingLandingPage session={session} />;
};

const Redirect: React.FC<{ to: string }> = ({ to }) => {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return <FullPageLoader />;
};

const FullPageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center text-fg-3" role="status">
    <Spinner size={20} />
    <span className="sr-only">Loading</span>
  </div>
);


function parseMonetization(creator: Creator | null): { amazon?: boolean } {
  try {
    return JSON.parse(creator?.monetization_json || '{}');
  } catch {
    return {};
  }
}

const AppShell: React.FC<{
  activeTab: TabId;
  creator: Creator;
  isSample: boolean;
  onSessionChanged: () => void;
  onSignOut: () => void;
}> = ({ activeTab, creator, isSample, onSessionChanged, onSignOut }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const usesAmazon = isSample || parseMonetization(creator).amazon === true;
  const visibleTabs = TABS.filter((t) => t.id !== 'amazon' || usesAmazon || activeTab === 'amazon');
  const current = [...TABS, { id: 'settings', label: 'Settings' } as TabItem].find((t) => t.id === activeTab);

  useEffect(() => {
    document.title = `${current?.label || 'Dashboard'} · CreatorBrain`;
    setMenuOpen(false);
  }, [current?.label]);

  // Move focus to the new view on client-side navigation so screen readers announce it
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [activeTab]);

  // Close the mobile menu with Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goTab = (id: TabId) => navigate(id === 'overview' ? '/app' : `/app/${id}`);
  const onNavigateTab = (id: string) => goTab(id as TabId);

  const NavRow: React.FC<{ tab: TabItem | { id: TabId; label: string; icon: TabItem['icon'] } }> = ({ tab }) => {
    const active = activeTab === tab.id;
    const Icon = tab.icon;
    return (
      <a
        {...linkProps(tab.id === 'overview' ? '/app' : `/app/${tab.id}`)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2 h-8 px-2 rounded-[8px] text-[14px] transition-colors ${
          active ? 'bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line)]' : 'text-fg-2 hover:bg-raised hover:text-fg'
        }`}
      >
        <Icon {...ICON} className={active ? 'text-fg' : 'text-fg-3'} />
        <span className="truncate">{tab.label}</span>
      </a>
    );
  };

  const groups: TabItem['group'][] = ['Create', 'Earn', 'Brain'];
  const initials = creator.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-page text-fg md:flex">
      <SkipLink />
      {/* Sidebar */}
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-[248px] bg-surface border-r border-line flex flex-col transition-[transform,visibility] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 md:visible ${
          menuOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-line">
          <a {...linkProps('/app')} aria-label="CreatorBrain dashboard">
            <Logo />
          </a>
          <button className="btn btn-ghost btn-sm md:hidden px-2" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X {...ICON} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace">
          {groups.map((group) => (
            <div key={group} role="group" aria-labelledby={`nav-group-${group}`}>
              <div id={`nav-group-${group}`} className="px-2 pt-6 pb-2 text-[12px] text-fg-3">{group}</div>
              <div className="flex flex-col gap-[2px]">
                {visibleTabs
                  .filter((t) => t.group === group)
                  .map((tab) => (
                    <NavRow key={tab.id} tab={tab} />
                  ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3 flex flex-col gap-[2px]">
          <NavRow tab={{ id: 'settings', label: 'Settings', icon: Settings }} />
          <a
            href={`/@${creator.handle}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 h-8 px-2 rounded-[8px] text-[14px] text-fg-2 hover:bg-raised hover:text-fg transition-colors"
          >
            <ExternalLink {...ICON} className="text-fg-3" />
            <span className="truncate">Public page</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <div className="mt-2 flex items-center gap-3 px-2 py-2">
            {creator.avatar_url ? (
              <img src={creator.avatar_url} alt={`${creator.name}'s profile photo`} width={32} height={32} className="w-8 h-8 rounded-full object-cover bg-raised" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-raised text-fg-2 text-[12px] font-medium flex items-center justify-center">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{creator.name}</div>
              <div className="meta truncate">@{creator.handle}</div>
            </div>
            <button className="btn btn-ghost btn-sm px-2" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut {...ICON} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-20 h-14 px-4 flex items-center gap-3 bg-surface border-b border-line">
          <button
            className="btn btn-ghost btn-sm px-2"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
          >
            <Menu {...ICON} />
          </button>
          <span className="font-medium">{current?.label}</span>
        </header>

      {/* Main */}
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 min-w-0 flex flex-col outline-none">

        {isSample && (
          <div className="border-b border-line bg-surface">
            <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-fg-2">
                You are viewing a sample workspace built from a real channel, IzooG10. Editing is turned off
              </span>
              <a {...linkProps('/signup')} className="btn btn-accent btn-sm">
                Create your account
              </a>
            </div>
          </div>
        )}

        {!isSample && <StudyBanner youtubeInput={creator.youtube_input} onChannelChanged={onSessionChanged} />}

        <div key={activeTab} className="rise-in flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8">
          {activeTab === 'overview' && <OverviewTab creator={creator} onNavigateTab={onNavigateTab} isSample={isSample} />}
          {activeTab === 'copilot' && <CopilotTab creator={creator} onNavigateTab={onNavigateTab} />}
          {activeTab === 'studio' && <ContentStudioTab />}
          {activeTab === 'tools' && <ToolsTab />}
          {activeTab === 'bio' && <LinkInBioTab creator={creator} />}
          {activeTab === 'links' && <ShortLinksTab />}
          {activeTab === 'amazon' && <AmazonAffiliateTab />}
          {activeTab === 'deals' && <DealsTab />}
          {activeTab === 'library' && <LibraryTab />}
          {activeTab === 'brain' && <BrainTab />}
          {activeTab === 'learn' && <LearnTab />}
          {activeTab === 'assess' && <AssessTab />}
          {activeTab === 'agents' && <AgentsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
      </div>
    </div>
  );
};
