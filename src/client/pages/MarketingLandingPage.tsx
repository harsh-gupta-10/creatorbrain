import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { api } from '../lib/api';
import { linkProps } from '../lib/router';
import { Logo, Meter, Spinner, ICON, SkipLink } from '../components/ui';
import { AskDemo, BreakdownShowcase, ModuleTour, AuditSection, ControlSection, SiteFooter } from './landing/sections';
import type { Creator } from '../../shared/types';

interface MarketingLandingPageProps {
  session: { loading: boolean; creator: Creator | null; isSample: boolean };
}

const STEPS = [
  {
    n: '01',
    title: 'Tell us where you publish',
    body: 'Your YouTube channel, Instagram captions, your niche and how you earn',
  },
  {
    n: '02',
    title: 'We study your recent content',
    body: 'Your latest uploads, titles, descriptions and views become your Brain in about a minute',
  },
  {
    n: '03',
    title: 'Draft in your voice',
    body: 'Every script, title and caption starts from what your audience already responds to',
  },
];

const FAQS = [
  {
    q: 'Is the channel audit really free',
    a: 'Yes. It needs no account and reads only your public uploads feed: titles, dates and view counts. The full study, with transcripts and thumbnails, starts when you create an account.',
  },
  {
    q: 'What does it read from my channel',
    a: 'Your public YouTube uploads feed: titles, descriptions, publish dates, view and like counts for your latest 15 videos. For Instagram, only the captions you paste during setup. It never posts or comments for you.',
  },
  {
    q: 'Do I need to be an Amazon Associate',
    a: 'No. During setup you tell us how you earn. If you do not use Amazon, the affiliate tools stay out of your way, and you can turn them on later in Settings.',
  },
  {
    q: 'How does it keep learning',
    a: 'Once a day it checks your channel for new uploads and refreshes your stats. You can also study your channel again from the dashboard at any time.',
  },
  {
    q: 'Can it track brand deals',
    a: 'Yes. Brand deals is a simple pipeline from first conversation to paid, with amounts, post dates and payment due dates. Overdue payments are flagged so nothing slips.',
  },
  {
    q: 'Which AI does it use',
    a: 'Cloudflare Workers AI by default, and Anthropic Claude when it is configured. If no model is reachable, your study still runs on title and view statistics, so nothing is made up.',
  },
];

export const MarketingLandingPage: React.FC<MarketingLandingPageProps> = ({ session }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const signedIn = !!session.creator && !session.isSample;

  useEffect(() => {
    document.title = 'CreatorBrain · Studies your channel, writes in your voice';
  }, []);

  const openSample = async () => {
    setSampleLoading(true);
    try {
      await api.auth.sample();
      window.location.href = '/app';
    } catch {
      setSampleLoading(false);
    }
  };

  const primaryCta = signedIn ? (
    <a {...linkProps('/app')} className="btn btn-primary btn-lg">
      Open your workspace
      <ArrowRight {...ICON} />
    </a>
  ) : (
    <a {...linkProps('/signup')} className="btn btn-primary btn-lg">
      Create your account
    </a>
  );

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-fg">
      <SkipLink />
      {/* Navigation */}
      <header className="sticky top-0 z-30 bg-[#f6f7f9]/95 border-b border-line">
        <div className="max-w-[1200px] mx-auto h-16 px-5 md:px-8 flex items-center justify-between">
          <a {...linkProps('/')} aria-label="CreatorBrain home">
            <Logo />
          </a>
          <nav className="hidden md:flex items-center gap-8 text-[14px] text-fg-2" aria-label="Primary">
            <a href="#how" className="hover:text-fg transition-colors">
              How it works
            </a>
            <a href="#features" className="hover:text-fg transition-colors">
              Features
            </a>
            <a {...linkProps('/audit')} className="hover:text-fg transition-colors">
              Free audit
            </a>
            <a href="#faq" className="hover:text-fg transition-colors">
              Questions
            </a>
          </nav>
          <div className="hidden md:flex items-center gap-4">
            {signedIn ? (
              <a {...linkProps('/app')} className="btn btn-primary btn-sm">
                Open workspace
              </a>
            ) : (
              <>
                <a {...linkProps('/login')} className="text-[14px] text-fg-2 hover:text-fg transition-colors">
                  Sign in
                </a>
                <a {...linkProps('/signup')} className="btn btn-primary btn-sm">
                  Create account
                </a>
              </>
            )}
          </div>
          <button
            className="md:hidden btn btn-ghost btn-sm px-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
          >
            {menuOpen ? <X {...ICON} /> : <Menu {...ICON} />}
          </button>
        </div>
        {menuOpen && (
          <nav
            id="landing-mobile-menu"
            aria-label="Primary"
            className="md:hidden border-t border-line px-5 py-4 flex flex-col gap-3 text-[14px]"
          >
            <a href="#how" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <a href="#features" onClick={() => setMenuOpen(false)}>
              Features
            </a>
            <a {...linkProps('/audit')}>Free audit</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>
              Questions
            </a>
            <div className="flex gap-2 pt-2">
              <a {...linkProps('/login')} className="btn btn-secondary btn-sm flex-1">
                Sign in
              </a>
              <a {...linkProps('/signup')} className="btn btn-primary btn-sm flex-1">
                Create account
              </a>
            </div>
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-5 md:px-8 pt-12 md:pt-0 md:min-h-[calc(100vh-64px)] grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div className="max-w-[520px] rise-in">
            <h1 className="text-[40px] leading-[44px] md:text-[60px] md:leading-[62px] font-medium tracking-[-0.03em]">
              Your next video, written the way your audience likes you
            </h1>
            <p className="mt-6 text-[18px] leading-[28px] text-fg-2 max-w-[36rem]">
              CreatorBrain studies your YouTube uploads and Instagram captions, learns how you title, hook and sell,
              then drafts scripts, packaging and affiliate links in your voice
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta}
              {!signedIn && (
                <button
                  className="btn btn-secondary btn-lg"
                  onClick={openSample}
                  disabled={sampleLoading}
                  aria-busy={sampleLoading}
                >
                  {sampleLoading && <Spinner size={14} />}
                  See a sample workspace
                </button>
              )}
            </div>
            <p className="mt-4 text-[14px] text-fg-2">
              Not ready to sign up?{' '}
              <a
                href="#audit"
                className="text-fg underline underline-offset-4 decoration-line-strong hover:decoration-fg"
              >
                Get a free channel audit
              </a>
            </p>
          </div>

          <HeroPreview />
        </section>

        <AskDemo />
        <BreakdownShowcase />
        <ModuleTour />
        <AuditSection signedIn={signedIn} />

        {/* How it works */}
        <section id="how" className="border-t border-line">
          <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-20 md:py-28">
            <h2 className="text-[32px] leading-[40px] font-medium tracking-[-0.02em] max-w-[560px]">
              Set up once. It keeps studying
            </h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="border-t border-line-strong pt-6">
                  <div className="meta">{s.n}</div>
                  <h3 className="mt-3 text-[17px] font-medium">{s.title}</h3>
                  <p className="mt-2 text-fg-2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <ControlSection />

        {/* FAQ */}
        <section id="faq" className="border-t border-line bg-surface">
          <div className="max-w-[760px] mx-auto px-5 md:px-8 py-20 md:py-28">
            <h2 className="text-[32px] leading-[40px] font-medium tracking-[-0.02em]">Questions</h2>
            <div className="mt-8 border-t border-line">
              {FAQS.map((f, i) => (
                <div key={f.q} className="border-b border-line">
                  <h3>
                    <button
                      id={`faq-q-${i}`}
                      className="w-full flex items-center justify-between gap-4 py-5 text-left"
                      aria-expanded={openFaq === i}
                      aria-controls={`faq-a-${i}`}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      <span className="text-[16px] font-medium">{f.q}</span>
                      <ChevronDown
                        {...ICON}
                        className={`text-fg-3 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={openFaq !== i}>
                    <p className="pb-5 -mt-1 text-fg-2 leading-[22px]">{f.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-line">
          <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-20 md:py-24 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <h2 className="text-[32px] leading-[40px] md:text-[40px] md:leading-[48px] font-medium tracking-[-0.02em] max-w-[620px]">
              Bring your channel. Setup takes about three minutes
            </h2>
            {primaryCta}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

/** The product moment: a channel study result, built in code with plausible data */
const PREVIEW_VIEWS = [41, 38, 52, 47, 36, 61, 44, 58, 49, 112, 63, 71];
const HeroPreview: React.FC = () => {
  const max = 120;
  return (
    <figure
      className="relative pb-12 md:pb-0 rise-in"
      style={{ animationDelay: '60ms' }}
      aria-label="Example channel study for @mayacooks"
    >
      <div className="panel shadow-[0_8px_24px_rgb(0_0_0/0.06)] overflow-hidden">
        <div className="h-11 px-4 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="font-medium">Channel study</span>
            <span className="text-fg-3">@mayacooks</span>
          </div>
          <span className="meta">12 uploads · Nov 14</span>
        </div>

        <div className="p-5 grid gap-5 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-fg-2">Views per upload</span>
              <span className="meta">median 50K</span>
            </div>
            <div
              className="mt-4 h-[148px] flex items-end gap-[6px] relative"
              role="img"
              aria-label={`Bar chart of views per upload for the last 12 uploads, in thousands: ${PREVIEW_VIEWS.join(', ')}. Median 50K; the tenth upload reached 112K.`}
            >
              <div
                className="absolute left-0 right-0 border-t border-dashed border-fg-3/50"
                style={{ bottom: `${(50 / max) * 100}%` }}
              />
              {PREVIEW_VIEWS.map((v, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-[3px] ${i === 9 ? 'bg-accent' : 'bg-[#d4d4d8]'}`}
                  style={{ height: `${(v / max) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-3 rounded-[8px] bg-accent-soft px-3 py-2">
              <div className="text-[13px] text-fg leading-5">One-pan dal for busy weeknights in 20 minutes</div>
              <div className="meta mt-[2px]">112K views · 2.2x your median</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[13px] text-fg-2">Learned</span>
            {[
              { k: 'Hook', v: 'Shows the finished dish first', c: 0.9 },
              { k: 'Titles', v: 'Time promise up front', c: 0.8 },
              { k: 'Tone', v: 'Warm, practical, no filler', c: 0.7 },
              { k: 'Gap', v: 'Descriptions skip ingredients', c: 0.6 },
            ].map((t) => (
              <div key={t.k} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] text-fg-3">{t.k}</div>
                  <div className="text-[13px] leading-5">{t.v}</div>
                </div>
                <Meter value={t.c} label={`${t.k} confidence`} className="mt-1 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line p-5">
          <div className="text-[13px] text-fg-2">Drafted for your next upload</div>
          <ul className="mt-3 flex flex-col gap-2">
            {['Weeknight palak paneer in 25 minutes, one pan', 'I cooked dinner for a week on $40: what worked'].map(
              (t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="meta w-5">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[14px]">{t}</span>
                  <span className="meta ml-auto hidden sm:inline">{t.length} ch</span>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </figure>
  );
};
