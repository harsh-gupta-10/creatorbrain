import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Check,
  FolderKanban,
  Bot,
  Link2,
  ShoppingBag,
  Brain as BrainIcon,
  ChevronDown,
  Smartphone,
  Send,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

interface MarketingLandingPageProps {
  onLaunchApp: (tab?: string) => void;
}

export const MarketingLandingPage: React.FC<MarketingLandingPageProps> = ({ onLaunchApp }) => {
  // Sandbox Simulator State
  const [activeRole, setActiveRole] = useState<'creator' | 'brand' | 'agency'>('creator');
  const [activeHeroTab, setActiveHeroTab] = useState<'auto-research' | 'studio' | 'affiliate'>('auto-research');
  const [sandboxPrompt, setSandboxPrompt] = useState<string>('');
  const [sandboxResponse, setSandboxResponse] = useState<{
    query: string;
    answer: string;
    productTitle?: string;
    productPrice?: string;
    badge?: string;
  } | null>({
    query: 'Review Motorola Edge 50 vs Vivo T3 Pro under ₹25k',
    answer:
      'Synthesized in Kabir’s signature Hinglish DNA voice! Generated 5 high-CTR titles, 8-minute pacing outline with minute 3:45 thermal camera pattern interrupt, and resolved live Amazon pricing.',
    productTitle: 'Motorola Edge 50 Fusion 5G (8GB RAM, 128GB)',
    productPrice: '₹22,999 (price as of Nov 13, 2026)',
    badge: 'Amazon Creators API Resolved',
  });

  // Calculator State
  const [selectedTools, setSelectedTools] = useState<Record<string, boolean>>({
    chatgpt: true,
    manychat: true,
    vidiq: true,
    linktree: true,
    bitly: true,
    compliance: true,
  });

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const sampleQueries = [
    {
      title: 'Why did my minute-4 retention dip?',
      answer:
        'Analyzed 3 recent teardown videos: retention dropped 14% at minute 3:45 during dry spec-sheet reading. Recommended: insert a 5-second physical camera macro zoom or audio sound bite before benchmark numbers.',
    },
    {
      title: 'Review Motorola Edge 50 vs Vivo T3 Pro',
      answer:
        'Product Researcher resolved both phones via Amazon Creators API. Generated 5 titles in Kabir DNA, 8-min script breakdown, tagged short links, and auto-added product cards to your Link-in-Bio.',
      productTitle: 'Motorola Edge 50 Fusion 5G (8GB RAM, 128GB)',
      productPrice: '₹22,999 (price as of Nov 13, 2026)',
      badge: 'Amazon Creators API Resolved',
    },
    {
      title: 'Who bought from my Amazon links this week?',
      answer:
        'Tracked 2,387 total clicks across 5 active links. Top converter: /mac-mini-m4-deal (842 clicks, ₹4,210 estimated commission). Best placement: Line 2 of YouTube description.',
    },
    {
      title: 'Can it write in Kabir’s Hinglish voice?',
      answer:
        'Strictly grounded in your Creator DNA: conversational pace, 75% English / 25% Hindi colloquial tech phrasing, zero sponsored fluff, and your signature catchphrase: "Let us pop the hood on this."',
    },
    {
      title: 'Draft a 45s Shorts script for M4 Mac Mini',
      answer:
        '0:00 Hook: "Base M4 Mac Mini 256GB SSD for 4K ProRes... Is Apple trolling us?"\n0:12 Teardown: Blackmagic disk speed test\n0:30 Verdict: External NVMe workaround saves ₹20,000\n0:42 Link in bio for tested drive enclosure.',
    },
    {
      title: 'Check FTC affiliate disclosure compliance',
      answer:
        'Compliance Checker verified: Pinned comment disclosure present, line 2 description disclosure active, and all Amazon pricing claims contain fresh timestamp. 100% compliant with Amazon Operating Agreement.',
    },
  ];

  const toolsCost: Record<string, { name: string; app: string; costInr: number; costUsd: number }> = {
    chatgpt: { name: 'Ideas, scripts and captions', app: 'ChatGPT Plus / Claude Pro', costInr: 1920, costUsd: 20 },
    manychat: { name: 'Auto-reply to comments & DMs', app: 'Manychat / Automations', costInr: 1340, costUsd: 15 },
    vidiq: { name: 'Video SEO & Thumbnail scoring', app: 'TubeBuddy / VidIQ Pro', costInr: 1920, costUsd: 20 },
    linktree: { name: 'Custom Link-in-Bio page', app: 'Linktree Pro / Beacons', costInr: 990, costUsd: 10 },
    bitly: { name: 'Tracked short links & analytics', app: 'Bitly Enterprise / Dub', costInr: 2400, costUsd: 25 },
    compliance: { name: 'FTC & Amazon Compliance Audit', app: 'Legal review / Manual checks', costInr: 2500, costUsd: 30 },
  };

  const totalMonthlySavingsInr = Object.entries(selectedTools).reduce(
    (acc, [key, selected]) => (selected ? acc + (toolsCost[key]?.costInr || 0) : acc),
    0
  );

  const toggleTool = (key: string) => {
    setSelectedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const faqs = [
    {
      q: 'How does CreatorBrain run 100% free on Cloudflare?',
      a: 'CreatorBrain is architected exclusively on Cloudflare’s generous Free Tier: Cloudflare Workers with Hono handles backend routing, D1 stores the relational knowledge graph, KV powers sub-millisecond link redirects, and React 19 is served as Workers Static Assets. Compressed bundle is only ~120 kB, well below the 3 MB limit.',
    },
    {
      q: 'How does the Amazon Creators API integration work?',
      a: 'The Product Researcher agent resolves products via Amazon Creators API / PA-API with SearchItems and GetItems operations. It pulls live specs, images, timestamped pricing, and generates tracked affiliate links formatted according to Amazon Operating Agreement Section 4 with mandatory price freshness disclaimers.',
    },
    {
      q: 'What is Creator DNA and how does it learn my voice?',
      a: 'During onboarding, our 6-agent pipeline analyzes your recent 10 videos (transcripts, thumbnail colors, title length, curiosity gaps, and editing rhythm). It builds a persistent mathematical profile (tone, Hinglish vocabulary, hook formulas, pacing) stored in Cloudflare D1 so all future scripts sound genuinely like you.',
    },
    {
      q: 'Can I bring my own AI provider API keys?',
      a: 'Yes! CreatorBrain includes a multi-provider AI router supporting Anthropic Claude (3.5 Sonnet / Haiku), OpenAI (GPT-4o), Google Gemini, and Cloudflare Workers AI. Your keys are encrypted locally using Web Crypto AES-GCM 256 with PBKDF2 and never logged.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 canvas-grid relative overflow-x-hidden selection:bg-rose-500/20 selection:text-rose-900">
      {/* Ambient Synclify-inspired warm mesh glow */}
      <div className="ambient-glow" />

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#fafaf9]/85 backdrop-blur-xl border-b border-slate-200/80 transition-colors">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <div
              onClick={() => onLaunchApp('overview')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-500 via-rose-500 to-purple-600 p-[1.5px] shadow-sm">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center text-sm">
                  🧠
                </div>
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-950 flex items-center gap-1.5">
                CreatorBrain
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                  OS
                </span>
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
              <button
                onClick={() => onLaunchApp('studio')}
                className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-950 transition flex items-center gap-1"
              >
                Product <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={() => onLaunchApp('copilot')}
                className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-950 transition flex items-center gap-1"
              >
                Copilot AI
              </button>
              <button
                onClick={() => onLaunchApp('amazon')}
                className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-950 transition"
              >
                Amazon Engine
              </button>
              <button
                onClick={() => onLaunchApp('brain')}
                className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-950 transition"
              >
                Brain Graph
              </button>
            </nav>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onLaunchApp('overview')}
              className="hidden sm:inline-flex text-sm font-semibold text-slate-700 hover:text-slate-950 px-3 py-2 transition"
            >
              Log in
            </button>
            <button
              onClick={() => onLaunchApp('overview')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95"
            >
              <span>Launch Creator OS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Marketing Hero */}
      <section className="pt-12 md:pt-20 pb-16 md:pb-24 px-5 md:px-8 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline & Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            {/* Ecosystem Lockup Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-xs text-slate-700 shadow-sm backdrop-blur">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-900">Amazon Creators API & Cloudflare Free Tier Partner</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.08]">
              The AI assistant for{' '}
              <span className="gradient-text-coral block sm:inline">
                your Creator Business.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Ask about your numbers, generate complete 9-asset video packages in your signature voice, auto-tag Amazon affiliate links, and run your Link-in-Bio page. All from one persistent autonomous brain.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onLaunchApp('overview')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-lg active:scale-95"
              >
                <span>Get started with Demo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onLaunchApp('copilot')}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-semibold text-sm transition shadow-sm active:scale-95"
              >
                <MessageSquare className="w-4 h-4 text-rose-500" />
                <span>Try Brain Copilot</span>
              </button>
              <a
                href="/@techkabir"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-sm transition shadow-sm"
              >
                <Smartphone className="w-4 h-4 text-indigo-500" />
                <span>Live Bio Page</span>
              </a>
            </div>

            {/* Sub-Badges Row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  FREE
                </span>
                Edge Link-in-Bio Page
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                  FREE
                </span>
                Creator DNA Graph Audit
              </span>
              <button
                onClick={() => onLaunchApp('studio')}
                className="text-slate-900 hover:text-rose-600 font-semibold inline-flex items-center gap-1 transition"
              >
                See how it works <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right Column: Synclify-inspired Floating Hero Card Preview */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md">
              {/* Floating notification badge (Synclify style) */}
              <div className="absolute -top-4 -left-4 z-20 bg-white/95 border border-slate-200/90 rounded-2xl p-3.5 shadow-xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-rose-500 flex items-center justify-center text-white text-base shadow-sm">
                  ⚡
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    CREATORBRAIN · JUST NOW
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    Synthesized 9 assets for Motorola review
                  </div>
                </div>
              </div>

              {/* Main Visual Phone/Card Box */}
              <div className="light-panel rounded-3xl p-5 shadow-2xl relative overflow-hidden border border-slate-200">
                <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

                  {/* Card Top */}
                  <div className="space-y-1 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-950/60 rounded-full border border-emerald-800/40">
                        ● DNA Voice Active
                      </span>
                      <span className="text-xs text-slate-300">@techkabir</span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white pt-2 leading-tight">
                      Motorola Edge 50 Fusion vs Vivo T3 Pro: The ₹22,000 Battle
                    </h3>
                  </div>

                  {/* Center Chat Bubble */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 space-y-2 relative z-10">
                    <div className="text-[11px] text-slate-300">
                      <span className="font-bold text-rose-300">Hook Formula:</span> "Don't buy until you see this camera teardown."
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
                      <span className="text-emerald-300 font-mono">₹22,999 on Amazon</span>
                      <span className="text-[10px] text-slate-400">Tracked Link /s/moto-edge</span>
                    </div>
                  </div>

                  {/* Bottom Action Pill */}
                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400 relative z-10">
                    <span>9 Assets Ready in Studio</span>
                    <button
                      onClick={() => onLaunchApp('studio')}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs transition"
                    >
                      View Studio →
                    </button>
                  </div>
                </div>

                {/* Floating Bottom Card: Auto DM / Link pill */}
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-800">Auto-Tagged Short Link:</span>
                  </div>
                  <span className="font-mono text-indigo-600 font-bold">/s/moto-edge-fusion</span>
                </div>
              </div>

              {/* Tab Pills below hero preview */}
              <div className="flex items-center justify-center gap-1.5 mt-4 p-1 bg-slate-200/60 rounded-full max-w-max mx-auto text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setActiveHeroTab('auto-research')}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeHeroTab === 'auto-research' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  Auto Research
                </button>
                <button
                  onClick={() => setActiveHeroTab('studio')}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeHeroTab === 'studio' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  Content Studio
                </button>
                <button
                  onClick={() => setActiveHeroTab('affiliate')}
                  className={`px-3 py-1.5 rounded-full transition ${
                    activeHeroTab === 'affiliate' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                  }`}
                >
                  Amazon Links
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: INTERACTIVE LIVE SIMULATED APP SANDBOX (Synclify-inspired) */}
      <section className="py-16 md:py-24 px-5 md:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center space-y-3 mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
            Interactive Product Demo
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
            This is the real app. Click anything to test it live.
          </h2>
          <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
            Switch between Creator, Brand, or Agency roles. Click any question below to see real-time AI responses and Amazon product resolution.
          </p>
        </div>

        {/* The Realistic App Window Frame */}
        <div className="light-panel rounded-3xl shadow-2xl border border-slate-300/80 overflow-hidden">
          {/* macOS Window Top Bar */}
          <div className="h-12 bg-slate-100/90 border-b border-slate-200 px-4 flex items-center justify-between">
            {/* Window Traffic Lights */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
            </div>

            {/* Role Switcher Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
              <button
                onClick={() => setActiveRole('creator')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeRole === 'creator'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Tech Creator (Kabir)
              </button>
              <button
                onClick={() => setActiveRole('brand')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeRole === 'brand'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Reviewer Brand
              </button>
              <button
                onClick={() => setActiveRole('agency')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeRole === 'agency'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Creator Agency
              </button>
            </div>

            {/* Simulated URL pill */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-white/80 px-3 py-1 rounded-lg border border-slate-200">
              <span className="text-emerald-500">🔒</span> app.creatorbrain.dev/copilot
            </div>
          </div>

          {/* Window Body: Sidebar + Assistant Canvas + Simulated Mobile Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
            {/* Left Simulated Sidebar (3 cols) */}
            <div className="lg:col-span-3 border-r border-slate-200 bg-slate-50/70 p-4 space-y-4">
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200 shadow-sm">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80"
                  alt="Kabir Verma"
                  className="w-8 h-8 rounded-full object-cover border border-rose-300"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">Kabir Verma</div>
                  <div className="text-[10px] text-slate-500">Tech & Hardware · 7.5k</div>
                </div>
              </div>

              <div className="space-y-1 text-xs font-semibold text-slate-600">
                <button
                  onClick={() => onLaunchApp('overview')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white transition text-slate-900"
                >
                  <TrendingUp className="w-4 h-4 text-slate-500" /> Dashboard
                </button>
                <button
                  onClick={() => onLaunchApp('copilot')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white text-slate-950 font-bold border border-slate-200 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4 text-rose-500" /> Brain Copilot
                </button>
                <button
                  onClick={() => onLaunchApp('studio')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white transition"
                >
                  <FolderKanban className="w-4 h-4 text-cyan-600" /> Content Studio
                </button>
                <button
                  onClick={() => onLaunchApp('amazon')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white transition"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-600" /> Amazon Affiliate
                </button>
                <button
                  onClick={() => onLaunchApp('brain')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white transition"
                >
                  <BrainIcon className="w-4 h-4 text-purple-600" /> Brain Graph
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Recent Researches
                </span>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="truncate p-1.5 rounded-lg hover:bg-white cursor-pointer">
                    • Moto Edge vs Vivo T3 Pro
                  </div>
                  <div className="truncate p-1.5 rounded-lg hover:bg-white cursor-pointer">
                    • M4 Mac Mini 4K edit test
                  </div>
                  <div className="truncate p-1.5 rounded-lg hover:bg-white cursor-pointer">
                    • Budget Rode mic comparison
                  </div>
                </div>
              </div>
            </div>

            {/* Center Interactive Assistant Canvas (6 cols) */}
            <div className="lg:col-span-6 p-6 flex flex-col justify-between bg-white space-y-6">
              {/* Center Top Prompt Section */}
              <div className="space-y-4">
                <div className="text-center space-y-1 pt-2">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-950">
                    Evening, Kabir. What do you want to create?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pick a question below to see real-time agent synthesis.
                  </p>
                </div>

                {/* 6 Clickable Question Pills (Synclify style) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sampleQueries.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSandboxPrompt(q.title);
                        setSandboxResponse({
                          query: q.title,
                          answer: q.answer,
                          productTitle: q.productTitle,
                          productPrice: q.productPrice,
                          badge: q.badge,
                        });
                      }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-left transition flex items-center justify-between text-xs font-semibold text-slate-800 hover:border-slate-300 group"
                    >
                      <span className="truncate pr-2">{q.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 shrink-0" />
                    </button>
                  ))}
                </div>

                {/* Live Output Box */}
                {sandboxResponse && (
                  <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200/90 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-rose-600" />
                        CreatorBrain Response
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        DNA Voice Grounded
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                      {sandboxResponse.answer}
                    </p>

                    {/* Resolved Product Card if present */}
                    {sandboxResponse.productTitle && (
                      <div className="p-3 bg-white border border-amber-300/80 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                        <div>
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                            📦 {sandboxResponse.badge}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {sandboxResponse.productTitle}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {sandboxResponse.productPrice}
                          </span>
                        </div>
                        <button
                          onClick={() => onLaunchApp('studio')}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shrink-0"
                        >
                          Open in Studio →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="p-2 rounded-2xl bg-slate-100 border border-slate-200/90 flex items-center gap-2">
                <input
                  type="text"
                  value={sandboxPrompt}
                  onChange={(e) => setSandboxPrompt(e.target.value)}
                  placeholder="Ask anything about your YouTube videos, Amazon deals, or scripts..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                />
                <button
                  onClick={() => onLaunchApp('copilot')}
                  className="p-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition"
                  title="Open in Copilot"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Mobile App Live Mirror (3 cols) */}
            <div className="lg:col-span-3 border-l border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-center items-center">
              <div className="w-full max-w-[240px] rounded-[36px] bg-slate-950 p-2.5 shadow-2xl border-4 border-slate-800">
                {/* Phone Speaker Notch */}
                <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto mb-2" />

                {/* Phone Screen */}
                <div className="rounded-[26px] bg-white p-3 space-y-3 min-h-[380px] text-slate-900 flex flex-col justify-between">
                  <div className="space-y-2 text-center pt-1">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80"
                      alt="Kabir Verma"
                      className="w-12 h-12 rounded-full object-cover mx-auto border-2 border-rose-500"
                    />
                    <div className="font-extrabold text-xs text-slate-950">Kabir Verma</div>
                    <div className="text-[10px] text-slate-500 font-mono">/@techkabir · Bio Page</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="p-2 rounded-xl bg-slate-100 text-[10px] font-bold text-center border border-slate-200">
                      🔥 Motorola Edge 50 Deal (₹22,999)
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 text-[10px] font-bold text-center border border-slate-200">
                      ⚡ M4 Mac Mini 4K Studio Setup
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 text-[10px] font-bold text-center border border-slate-200">
                      🎙️ Budget Mic Kit on Amazon
                    </div>
                  </div>

                  <div className="text-center pt-2 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 font-mono">
                      Sub-millisecond Edge Bio · D1 Powered
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 mt-3 font-medium">
                Live mobile sync preview
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: "SAY IT ONCE, RUN IT ANYWHERE" */}
      <section className="py-16 md:py-24 px-5 md:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
            Omnichannel Autonomous Execution
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
            Say it once. 13 agents run it everywhere.
          </h2>
          <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
            You don't need to manually click through 6 different dashboards. Just speak or type your video concept, and your agents orchestrate everything in parallel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="light-card p-5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">"Review Motorola Edge 50, ₹22k budget"</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                Voice & Chat
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Product Researcher pulls live specs from Amazon Creators API; Studio Agent writes 5 title options and full description.
            </p>
          </div>

          <div className="light-card p-5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">"Why did retention dip at minute 3:45?"</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                Diagnostician
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Diagnostician inspects audience graph, isolates dry spec reading, and schedules an interactive coaching lesson.
            </p>
          </div>

          <div className="light-card p-5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">"Generate tracked links for my description"</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                Link Agent
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Registers transparent KV short links (`/s/:slug`), generates tagged Amazon affiliate URLs, and auto-adds product cards to Bio.
            </p>
          </div>

          <div className="light-card p-5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">"Check FTC and Amazon Compliance"</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-200">
                Compliance
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Verifies mandatory affiliate disclosure lines and ensures pricing claims include fresh date timestamps.
            </p>
          </div>

          <div className="light-card p-5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">"Draft a 45s Shorts & Reels script"</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                Shorts Agent
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Cuts down long-form comparison into vertical 9:16 high-velocity hook with verbal CTA to pinned link.
            </p>
          </div>

          <div className="light-card p-5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">"Autonomous Daily Cron Fleet"</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                Hourly Cron
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Memory Curator merges redundant style traits, evaluates click-through performance, and updates the dashboard Next Best Action.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE ICONIC TOOL REPLACEMENT & SAVINGS CALCULATOR (Synclify style) */}
      <section className="py-16 md:py-24 px-5 md:px-8 max-w-7xl mx-auto relative z-10">
        <div className="light-panel rounded-3xl p-6 md:p-10 border border-slate-300/80 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Apps to stop paying for */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Consolidate Your Creator Stack
                </span>
                <h3 className="text-2xl md:text-3xl font-extrabold text-slate-950 tracking-tight mt-1">
                  Replace 6+ scattered subscriptions with one autonomous brain.
                </h3>
                <p className="text-xs md:text-sm text-slate-600 mt-1">
                  Check or uncheck the tools you currently use to calculate your monthly savings:
                </p>
              </div>

              {/* Checklist */}
              <div className="space-y-2 pt-2">
                {Object.entries(toolsCost).map(([key, item]) => {
                  const isChecked = selectedTools[key] ?? false;
                  return (
                    <div
                      key={key}
                      onClick={() => toggleTool(key)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-white border-slate-300 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                            isChecked ? 'bg-slate-950 text-white' : 'border border-slate-400 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.name}</div>
                          <div className="text-[11px] text-slate-500">{item.app}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          ₹{item.costInr.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">/ month</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Savings Summary Card (Synclify style) */}
            <div className="lg:col-span-5">
              <div className="p-6 md:p-8 rounded-3xl bg-[#0f172a] text-white shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    What you spend today
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-extrabold line-through text-slate-400 font-mono">
                      ₹{totalMonthlySavingsInr.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-300">/ month</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    That's ₹{(totalMonthlySavingsInr * 12).toLocaleString()} every year in fragmented subscriptions.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      CreatorBrain on Cloudflare
                    </span>
                    <span className="text-xs font-extrabold text-emerald-400 font-mono">
                      ₹0 / Free Tier
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Zero platform fees. Host on Cloudflare Workers Free Tier (100,000 req/day, D1 database, KV edge caching) with BYO API keys.
                  </p>
                </div>

                <button
                  onClick={() => onLaunchApp('overview')}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-bold text-sm transition shadow-lg shadow-rose-500/25 active:scale-95"
                >
                  Start Saving with CreatorBrain →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: 4 CORE SYSTEM PILLARS */}
      <section className="py-16 md:py-24 px-5 md:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">
            End-to-End Capabilities
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
            Built from scratch for modern video creators.
          </h2>
          <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
            Everything your channel needs to research, script, monetize, and audit in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="light-panel p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <BrainIcon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Persistent Creator DNA</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              14 graph nodes and 18 edges in Cloudflare D1 retain your exact pacing, catchphrases, vocabulary mix, and thumbnail visual identity.
            </p>
          </div>

          <div className="light-panel p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">9-Asset Content Studio</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Synthesizes 5 titles, description, tags, pinned comment, Shorts script, IG caption, outline, thumbnail concepts, and community polls.
            </p>
          </div>

          <div className="light-panel p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Amazon Creators API</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automatic product resolution with price freshness timestamps, ASIN validation, and FTC-compliant disclosure tracking.
            </p>
          </div>

          <div className="light-panel p-6 rounded-3xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Link2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-950">Sub-ms Edge Short Links</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cloudflare KV transparent redirect engine with SSRF domain safety and server-rendered Link-in-Bio pages.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: FAQ ACCORDION */}
      <section className="py-16 md:py-24 px-5 md:px-8 max-w-4xl mx-auto relative z-10">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-slate-600">
            Everything you need to know about hosting, Amazon compliance, and agent workflows.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="light-panel rounded-2xl border border-slate-200/90 overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 md:p-5 text-left flex items-center justify-between font-bold text-sm text-slate-900"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-rose-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 7: FINAL CTA BANNER */}
      <section className="py-16 px-5 md:px-8 max-w-7xl mx-auto relative z-10">
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-8 md:p-14 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Open Innovation · Hack2Skill & Google AgentX 2.0
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              Ready to run your channel on an autonomous brain?
            </h2>
            <p className="text-sm md:text-base text-slate-300">
              Try the pre-analyzed demo channel or onboard your own YouTube or Instagram handle in under 2 minutes.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 relative z-10">
            <button
              onClick={() => onLaunchApp('overview')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm transition shadow-lg active:scale-95"
            >
              <span>Launch Creator OS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLaunchApp('copilot')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition backdrop-blur active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat with Copilot</span>
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 bg-white py-12 px-5 md:px-8 text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-orange-500 to-rose-500 flex items-center justify-center text-white text-xs">
              🧠
            </div>
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">CreatorBrain OS</span>
            <span>·</span>
            <span>Agentic Creator Operating System</span>
          </div>

          <div className="flex items-center gap-6 font-medium text-slate-600">
            <button onClick={() => onLaunchApp('overview')} className="hover:text-slate-900">
              App
            </button>
            <button onClick={() => onLaunchApp('copilot')} className="hover:text-slate-900">
              Copilot
            </button>
            <button onClick={() => onLaunchApp('studio')} className="hover:text-slate-900">
              Studio
            </button>
            <button onClick={() => onLaunchApp('amazon')} className="hover:text-slate-900">
              Amazon
            </button>
            <a href="/@techkabir" target="_blank" rel="noreferrer" className="hover:text-slate-900">
              Bio Page
            </a>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Cloudflare Free Tier</span>
            <span>•</span>
            <span>React 19</span>
            <span>•</span>
            <span>Hono</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
