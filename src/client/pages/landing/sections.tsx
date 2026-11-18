// Landing page sections. All sample data is clearly an example (@mayacooks); nothing here
// claims real customers, metrics or prices.

import React, { useId, useState } from 'react';
import {
  ArrowRight,
  Clapperboard,
  Library,
  Network,
  Link2,
  Handshake,
  ShoppingBag,
  EyeOff,
  KeyRound,
  Trash2,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { linkProps } from '../../lib/router';
import { Logo, Meter, ICON, Segmented } from '../../components/ui';
import { AuditForm, AuditReport } from '../AuditPage';
import type { ChannelAudit } from '../../lib/api';

const H2 = 'text-[32px] leading-[40px] font-medium tracking-[-0.02em]';
const WRAP = 'max-w-[1200px] mx-auto px-5 md:px-8';

// ------------------------------------------------------------------
// Ask about your channel
// ------------------------------------------------------------------

type QKey = 'why' | 'next' | 'titles' | 'deal';
const QUESTIONS: { value: QKey; label: string }[] = [
  { value: 'why', label: 'Why did my dal video do so well' },
  { value: 'next', label: 'What should I make next' },
  { value: 'titles', label: 'Rewrite this title' },
  { value: 'deal', label: 'Which deals are overdue' },
];

const ANSWERS: Record<QKey, React.ReactNode> = {
  why: (
    <>
      <p>
        <strong>One-pan dal for busy weeknights in 20 minutes</strong> reached 112K views, 2.2x your median. Three
        things stand out against your other uploads:
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        <li>
          <span className="meta mr-2">01</span>The first line is the finished dish: “This is dinner, and it took one
          pan.” Your lower performers open with an intro
        </li>
        <li>
          <span className="meta mr-2">02</span>The title promises a time, “20 minutes”. 4 of your top 5 uploads do this
        </li>
        <li>
          <span className="meta mr-2">03</span>The thumbnail shows the dish close up with two words, “ONE PAN”
        </li>
      </ol>
    </>
  ),
  next: (
    <>
      <p>Based on your topics and what beat your median, three ideas in your format:</p>
      <ul className="mt-3 flex flex-col gap-2">
        <li>
          <span className="meta mr-2">01</span>Weeknight palak paneer in 25 minutes, one pan
        </li>
        <li>
          <span className="meta mr-2">02</span>I cooked dinner for a week on $40: what worked
        </li>
        <li>
          <span className="meta mr-2">03</span>3 dals, 3 spice levels: which one is worth it
        </li>
      </ul>
      <p className="mt-3 text-fg-3">Open one in the Studio to get a script outline, description and captions</p>
    </>
  ),
  titles: (
    <>
      <p className="text-fg-3">“My honest thoughts on making bread at home after a few weeks”</p>
      <p className="mt-3">Your best titles put the payoff first and use a number. Try:</p>
      <ul className="mt-2 flex flex-col gap-2">
        <li>
          <span className="meta mr-2">48 ch</span>Homemade bread for 3 weeks: what finally worked
        </li>
        <li>
          <span className="meta mr-2">41 ch</span>Why your bread is dense (and the 1 fix)
        </li>
      </ul>
    </>
  ),
  deal: (
    <>
      <p>One payment is overdue:</p>
      <div className="mt-3 well px-4 py-3 flex items-center justify-between gap-3">
        <span>
          <strong>Spice Co.</strong> · dedicated Short
        </span>
        <span className="meta text-negative">due Nov 10 · $600</span>
      </div>
      <p className="mt-3 text-fg-3">Posted Nov 2. Want a polite reminder email drafted?</p>
    </>
  ),
};

export const AskDemo: React.FC = () => {
  const [q, setQ] = useState<QKey>('why');
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="ask-h">
      <div className={`${WRAP} py-20 md:py-28 grid gap-12 md:grid-cols-[1fr_1.2fr] md:items-center`}>
        <div>
          <h2 id="ask-h" className={H2}>
            Ask about your channel in plain words
          </h2>
          <p className="mt-4 text-fg-2 max-w-[460px]">
            Copilot answers from your own uploads, transcripts and deals, so the answer is about you, not creators in
            general. Pick a question to see an example
          </p>
          <div className="mt-6 flex flex-col gap-2 max-w-[420px]" role="group" aria-label="Example questions">
            {QUESTIONS.map((item) => (
              <button
                key={item.value}
                onClick={() => setQ(item.value)}
                aria-pressed={q === item.value}
                className={`text-left px-4 h-11 rounded-[10px] border text-[14px] transition-colors ${
                  q === item.value ? 'border-fg bg-surface text-fg' : 'border-line-strong text-fg-2 hover:bg-raised'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <figure
          className="panel overflow-hidden shadow-[0_8px_24px_rgb(0_0_0/0.06)]"
          aria-label="Example Copilot answer"
        >
          <div className="h-11 px-4 flex items-center justify-between border-b border-line text-[13px]">
            <span className="font-medium">Copilot</span>
            <span className="text-fg-3">@mayacooks · example</span>
          </div>
          <div className="p-5 flex flex-col gap-4 min-h-[300px]">
            <div className="self-end max-w-[80%] rounded-[10px] bg-raised px-4 py-2 text-[14px]">
              {QUESTIONS.find((x) => x.value === q)?.label}
            </div>
            <div
              className="text-[14px] leading-[22px] text-fg-2 [&_strong]:text-fg [&_strong]:font-medium"
              aria-live="polite"
            >
              {ANSWERS[q]}
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
};

// ------------------------------------------------------------------
// Every video, taken apart
// ------------------------------------------------------------------

export const BreakdownShowcase: React.FC = () => (
  <section className="border-t border-line" aria-labelledby="bd-h">
    <div className={`${WRAP} py-20 md:py-28 grid gap-12 md:grid-cols-[1.2fr_1fr] md:items-center`}>
      <figure className="panel overflow-hidden order-2 md:order-1" aria-label="Example video breakdown">
        <div className="p-5 border-b border-line flex gap-4">
          <div
            className="w-[120px] h-[68px] rounded-[8px] bg-[#e7e2d8] shrink-0 relative overflow-hidden"
            aria-hidden="true"
          >
            <div className="absolute inset-x-3 bottom-3 h-3 rounded-[3px] bg-[#c9a227]/70" />
            <div className="absolute left-3 top-3 text-[11px] font-medium text-[#3b2f1e]">ONE PAN</div>
          </div>
          <div className="min-w-0">
            <div className="font-medium leading-5">One-pan dal for busy weeknights in 20 minutes</div>
            <div className="meta mt-1">Oct 21 · 9:42 · 112K views · 2.2x median</div>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-fg-3">Hook · result first</span>
              <Meter value={0.9} label="Hook strength" />
            </div>
            <blockquote className="well px-4 py-3 text-[14px]">
              “This is dinner, and it took one pan. Here's the whole thing.”
            </blockquote>
          </div>
          <ol className="text-[14px]">
            {[
              ['0:00', 'Finished dish, the promise'],
              ['0:18', 'Ingredients on one board'],
              ['1:05', 'Tempering, the one tricky step'],
              ['7:40', 'Taste test and serving ideas'],
            ].map(([t, l]) => (
              <li key={t} className="flex gap-3 py-2 border-t border-line first:border-t-0">
                <span className="meta w-10 pt-[2px]">{t}</span>
                {l}
              </li>
            ))}
          </ol>
          <div className="grid gap-4 sm:grid-cols-2 text-[14px]">
            <div>
              <div className="text-[13px] text-fg-3 mb-2">What worked</div>
              <p className="flex gap-2">
                <Check {...ICON} className="text-positive mt-[2px] shrink-0" />
                Shows the payoff before any talking
              </p>
            </div>
            <div>
              <div className="text-[13px] text-fg-3 mb-2">Make another like it</div>
              <p>Same format with rajma: one pan, a time in the title, dish-first opening</p>
            </div>
          </div>
        </div>
      </figure>

      <div className="order-1 md:order-2">
        <h2 id="bd-h" className={H2}>
          Every video, taken apart
        </h2>
        <p className="mt-4 text-fg-2">
          CreatorBrain reads the transcript of each upload, looks at its thumbnail and writes down what happens and why
          it worked. You can read all of it in your Library
        </p>
        <ul className="mt-6 flex flex-col gap-3 text-[14px]">
          {[
            'Full transcript with timestamps that jump into the video',
            'Hook, structure, pacing, calls to action and products mentioned',
            'Thumbnail text, face, colors and layout',
            'What worked, what to improve and how to make another like it',
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <Check {...ICON} className="text-fg-3 mt-[2px] shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

// ------------------------------------------------------------------
// Module tour
// ------------------------------------------------------------------

type ModuleKey = 'studio' | 'library' | 'brain' | 'bio' | 'deals' | 'amazon';
const MODULES: {
  key: ModuleKey;
  label: string;
  icon: typeof Clapperboard;
  title: string;
  body: string;
  rows: [string, string][];
}[] = [
  {
    key: 'studio',
    label: 'Studio',
    icon: Clapperboard,
    title: 'From idea to every asset for one video',
    body: 'Titles, script outline, description with chapters, pinned comment, Shorts and Reels captions, all drafted from your past uploads',
    rows: [
      ['Titles', '5 options'],
      ['Script outline', '6 sections'],
      ['Description', 'with chapters'],
      ['Captions', 'Shorts and Reels'],
    ],
  },
  {
    key: 'library',
    label: 'Library',
    icon: Library,
    title: 'Everything we studied, searchable',
    body: 'Each video and post with its transcript, thumbnail notes and breakdown. Search a phrase across all your transcripts',
    rows: [
      ['One-pan dal', '112K · studied'],
      ['Bread, 3 weeks', '61K · studied'],
      ['Rajma Sunday', '48K · studied'],
      ['Kitchen tour', 'waiting'],
    ],
  },
  {
    key: 'brain',
    label: 'Brain',
    icon: Network,
    title: 'What makes your channel yours',
    body: 'Strengths, gaps, topics and audience learned from your content, linked to the videos that show them',
    rows: [
      ['Strength', 'Result-first hooks'],
      ['Gap', 'Descriptions skip ingredients'],
      ['Topic', 'Weeknight dinners'],
      ['Audience', 'Busy home cooks'],
    ],
  },
  {
    key: 'bio',
    label: 'Link in bio',
    icon: Link2,
    title: 'Your page, and links that count clicks',
    body: 'A public page at your handle plus short links for descriptions, with clicks by country, device and referrer',
    rows: [
      ['/s/dal-pan', '1,284 clicks'],
      ['/s/spice-kit', '611 clicks'],
      ['/@mayacooks', '3,902 views'],
      ['Top country', 'India'],
    ],
  },
  {
    key: 'deals',
    label: 'Brand deals',
    icon: Handshake,
    title: 'Sponsorships from first email to paid',
    body: 'A simple pipeline with amounts, post dates and payment due dates, and a nudge when a payment is late',
    rows: [
      ['Talking', '2 brands'],
      ['Agreed', '$1,200'],
      ['Posted', '$600 · 1 overdue'],
      ['Paid, 90 days', '$2,450'],
    ],
  },
  {
    key: 'amazon',
    label: 'Amazon',
    icon: ShoppingBag,
    title: 'Affiliate links only if you use them',
    body: 'Links tagged with your own tracking ID, product cards, dated prices and disclosures in the right place. Your keys are encrypted',
    rows: [
      ['Tracking ID', '••••-21 encrypted'],
      ['Products', '6 saved'],
      ['Disclosure', 'first 3 lines'],
      ['Earnings', 'CSV import'],
    ],
  },
];

export const ModuleTour: React.FC = () => {
  const [active, setActive] = useState<ModuleKey>('studio');
  const m = MODULES.find((x) => x.key === active)!;
  const panelId = useId();
  return (
    <section id="features" className="border-t border-line bg-surface" aria-labelledby="tour-h">
      <div className={`${WRAP} py-20 md:py-28`}>
        <h2 id="tour-h" className={`${H2} max-w-[620px]`}>
          One workspace for the work around a video
        </h2>
        <div className="mt-8 overflow-x-auto">
          <Segmented<ModuleKey>
            label="Product areas"
            value={active}
            onChange={setActive}
            options={MODULES.map((x) => ({ value: x.key, label: x.label }))}
          />
        </div>
        <div id={panelId} className="mt-8 grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center" aria-live="polite">
          <div>
            <m.icon {...ICON} className="text-fg-2" />
            <h3 className="mt-4 text-[22px] leading-[30px] font-medium">{m.title}</h3>
            <p className="mt-3 text-fg-2 max-w-[440px]">{m.body}</p>
          </div>
          <div className="card divide-y divide-line" aria-label={`${m.label} example`}>
            {m.rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 h-12 text-[14px]">
                <span>{k}</span>
                <span className="meta">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------------
// Free audit
// ------------------------------------------------------------------

export const AuditSection: React.FC<{ signedIn: boolean }> = ({ signedIn }) => {
  const [audit, setAudit] = useState<ChannelAudit | null>(null);
  return (
    <section id="audit" className="border-t border-line" aria-labelledby="audit-section-h">
      <div className={`${WRAP} py-20 md:py-28`}>
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-end">
          <div>
            <h2 id="audit-section-h" className={H2}>
              Free channel audit
            </h2>
            <p className="mt-4 text-fg-2 max-w-[460px]">
              Paste your channel and get a score for consistency, titles, reach and momentum, the day your uploads do
              best, and three fixes to try next. No account needed
            </p>
          </div>
          <AuditForm onResult={setAudit} compact />
        </div>
        <div className="mt-10" aria-live="polite">
          {audit && <AuditReport audit={audit} signedIn={signedIn} />}
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------------
// You stay in control
// ------------------------------------------------------------------

const CONTROL = [
  {
    icon: EyeOff,
    title: 'Read-only',
    body: 'It reads your public uploads and captions. It never posts, comments or messages for you',
  },
  {
    icon: KeyRound,
    title: 'Your keys stay sealed',
    body: 'Amazon tracking IDs and API keys are encrypted per creator and never shown back in full',
  },
  {
    icon: ShieldCheck,
    title: 'Your data is yours',
    body: 'Transcripts and breakdowns are stored in your workspace only, visible to you alone',
  },
  {
    icon: Trash2,
    title: 'Delete everything',
    body: 'One button in Settings removes your account and every row of data we hold',
  },
];

export const ControlSection: React.FC = () => (
  <section className="border-t border-line bg-surface" aria-labelledby="control-h">
    <div className={`${WRAP} py-20 md:py-28`}>
      <h2 id="control-h" className={`${H2} max-w-[560px]`}>
        You stay in control
      </h2>
      <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {CONTROL.map((c) => (
          <li key={c.title} className="border-t border-line-strong pt-6">
            <c.icon {...ICON} className="text-fg-2" />
            <h3 className="mt-4 font-medium">{c.title}</h3>
            <p className="mt-2 text-[14px] text-fg-2 leading-[22px]">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

// ------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------

export const SiteFooter: React.FC = () => (
  <footer className="border-t border-line">
    <div className={`${WRAP} py-12 grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]`}>
      <div>
        <Logo />
        <p className="mt-3 text-[13px] text-fg-2 max-w-[280px]">
          Studies your YouTube and Instagram content and drafts your next video in your voice
        </p>
      </div>
      <nav aria-label="Product">
        <h2 className="text-[13px] text-fg-3 mb-3">Product</h2>
        <ul className="flex flex-col gap-2 text-[14px] text-fg-2">
          <li>
            <a href="#features" className="hover:text-fg">
              Features
            </a>
          </li>
          <li>
            <a href="#how" className="hover:text-fg">
              How it works
            </a>
          </li>
          <li>
            <a href="#faq" className="hover:text-fg">
              Questions
            </a>
          </li>
        </ul>
      </nav>
      <nav aria-label="Free tools">
        <h2 className="text-[13px] text-fg-3 mb-3">Free tools</h2>
        <ul className="flex flex-col gap-2 text-[14px] text-fg-2">
          <li>
            <a {...linkProps('/audit')} className="hover:text-fg">
              Channel audit
            </a>
          </li>
          <li>
            <a {...linkProps('/signup')} className="hover:text-fg">
              Link in bio page
            </a>
          </li>
        </ul>
      </nav>
      <nav aria-label="Project">
        <h2 className="text-[13px] text-fg-3 mb-3">Project</h2>
        <ul className="flex flex-col gap-2 text-[14px] text-fg-2">
          <li>
            <a
              href="https://github.com/harsh-gupta-10/creatorbrain"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fg"
            >
              Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a {...linkProps('/login')} className="hover:text-fg">
              Sign in
            </a>
          </li>
        </ul>
      </nav>
    </div>
    <div
      className={`${WRAP} py-6 border-t border-line flex flex-col sm:flex-row gap-2 justify-between text-[12px] text-fg-3`}
    >
      <span>Runs on Cloudflare. Reads public data only</span>
      <a {...linkProps('/audit')} className="inline-flex items-center gap-1 hover:text-fg">
        Try the free audit <ArrowRight size={12} strokeWidth={1.5} aria-hidden="true" />
      </a>
    </div>
  </footer>
);
