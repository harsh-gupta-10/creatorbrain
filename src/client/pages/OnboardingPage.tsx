import React, { useEffect, useRef, useState } from 'react';
import { Check, Circle, ArrowLeft, ArrowRight, RotateCw, SquarePlay, Camera } from 'lucide-react';
import { api, type OnboardingProfile, type StudyJob } from '../lib/api';
import { Logo, Spinner, ErrorNote, ICON, SkipLink } from '../components/ui';
import type { Creator } from '../../shared/types';

interface Props {
  creator: Creator;
  onComplete: () => void;
}

type Step = 'channel' | 'earn' | 'goals' | 'study';
const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'channel', label: 'Your channel', hint: 'Where you publish' },
  { id: 'earn', label: 'How you earn', hint: 'Affiliate and other income' },
  { id: 'goals', label: 'Goals', hint: 'What to focus on' },
  { id: 'study', label: 'Channel study', hint: 'One to two minutes' },
];

const INCOME = ['Brand sponsorships', 'Own products or courses', 'Memberships', 'Other affiliate programs'];
const GOALS = [
  'Grow subscribers',
  'Earn more from affiliate links',
  'Publish more consistently',
  'Write better titles and thumbnails',
  'Land brand deals',
  'Learn the craft',
];
const MARKETPLACES = ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.ca'];

const Choice: React.FC<{
  checked: boolean;
  onChange: () => void;
  type?: 'checkbox' | 'radio';
  name?: string;
  children: React.ReactNode;
  description?: string;
}> = ({ checked, onChange, type = 'checkbox', name, children, description }) => (
  <label
    className={`flex items-start gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors ${
      checked ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-raised'
    }`}
  >
    <input type={type} name={name} checked={checked} onChange={onChange} className="mt-[2px] accent-[#2f5bea] w-4 h-4" />
    <span className="min-w-0">
      <span className="block text-[14px] text-fg">{children}</span>
      {description && <span className="block mt-[2px] text-[13px] text-fg-2">{description}</span>}
    </span>
  </label>
);

export const OnboardingPage: React.FC<Props> = ({ creator, onComplete }) => {
  const [step, setStep] = useState<Step>(creator.onboarding_status === 'study' ? 'study' : 'channel');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstStep = useRef(true);

  const [profile, setProfile] = useState<OnboardingProfile>({
    niche: creator.niche || '',
    language: creator.content_language || 'English',
    cadence: (creator.upload_cadence as OnboardingProfile['cadence']) || 'weekly',
    youtube: creator.youtube_input || '',
    instagram: creator.instagram_handle || '',
    instagramCaptions: [],
    amazon: { enabled: false, partnerTag: '', marketplace: 'amazon.com' },
    otherIncome: [],
    goals: [],
  });
  const [captionsText, setCaptionsText] = useState('');

  const set = <K extends keyof OnboardingProfile>(key: K, value: OnboardingProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));
  const toggle = (key: 'otherIncome' | 'goals', value: string) =>
    setProfile((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }));

  useEffect(() => {
    document.title = 'Set up your workspace · CreatorBrain';
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // Each step replaces the page content: move focus to the top so the new heading is read
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [step]);

  const next = async () => {
    setError('');
    if (step === 'channel') {
      if (profile.niche.trim().length < 2) return setError('Tell us what your channel is about');
      const captions = captionsText
        .split(/\n\s*\n|\n---\n/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (!profile.youtube.trim() && captions.length === 0) {
        return setError('Add your YouTube channel, or paste a few Instagram captions so we have something to study');
      }
      setProfile((p) => ({ ...p, instagramCaptions: captions.slice(0, 12) }));
      return setStep('earn');
    }
    if (step === 'earn') {
      if (profile.amazon.enabled && !/^[\w-]{3,40}$/.test(profile.amazon.partnerTag)) {
        return setError('Enter your Amazon Associates tracking ID, like yourname-20');
      }
      return setStep('goals');
    }
    if (step === 'goals') {
      setSaving(true);
      try {
        await api.onboarding.saveProfile(profile);
        setStep('study');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not save your answers');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <SkipLink />
      <header className="h-16 px-6 md:px-8 flex items-center justify-between border-b border-line bg-surface">
        <Logo />
        <span className="meta">
          Step {stepIndex + 1} of {STEPS.length}
        </span>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="outline-none max-w-[1040px] mx-auto px-4 md:px-8 py-10 md:py-16 grid gap-10 md:grid-cols-[220px_1fr]"
      >
        {/* Step rail */}
        <ol className="hidden md:flex flex-col gap-1" aria-label="Setup steps">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} className="flex items-start gap-3 py-2" aria-current={active ? 'step' : undefined}>
                <span
                  aria-hidden="true"
                  className={`mt-[2px] w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono ${
                    done ? 'bg-fg text-white' : active ? 'bg-accent text-white' : 'bg-raised text-fg-3'
                  }`}
                >
                  {done ? <Check size={12} strokeWidth={2} /> : i + 1}
                </span>
                <span>
                  <span className={`block text-[14px] ${active ? 'text-fg font-medium' : done ? 'text-fg' : 'text-fg-3'}`}>
                    {s.label}
                    <span className="sr-only">{done ? ' (done)' : active ? ' (current step)' : ''}</span>
                  </span>
                  <span className="block text-[12px] text-fg-3">{s.hint}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <section className="min-w-0 max-w-[600px]">
          {step === 'channel' && (
            <div className="rise-in">
              <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">Where do you publish</h1>
              <p className="mt-2 text-fg-2">
                We read your public uploads to learn how you title, hook and talk. Nothing is posted on your behalf
              </p>

              <div className="mt-8 flex flex-col gap-6">
                <div>
                  <label htmlFor="yt" className="field-label">
                    YouTube channel
                  </label>
                  <div className="relative">
                    <SquarePlay {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
                    <input
                      id="yt"
                      aria-describedby="yt-hint"
                      className="input pl-9"
                      placeholder="@yourchannel or channel URL"
                      value={profile.youtube}
                      onChange={(e) => set('youtube', e.target.value)}
                    />
                  </div>
                  <p id="yt-hint" className="field-hint">We study your latest 15 uploads from the public feed</p>
                </div>

                <div>
                  <label htmlFor="ig" className="field-label">
                    Instagram handle <span className="text-fg-3 font-normal">optional</span>
                  </label>
                  <div className="relative">
                    <Camera {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
                    <input
                      id="ig"
                      className="input pl-9"
                      placeholder="@yourhandle"
                      value={profile.instagram}
                      onChange={(e) => set('instagram', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="captions" className="field-label">
                    Recent Instagram captions <span className="text-fg-3 font-normal">optional</span>
                  </label>
                  <textarea
                    id="captions"
                    aria-describedby="captions-hint"
                    className="input min-h-[112px]"
                    placeholder="Paste 3 to 10 captions, with a blank line between each"
                    value={captionsText}
                    onChange={(e) => setCaptionsText(e.target.value)}
                  />
                  <p id="captions-hint" className="field-hint">Instagram has no public feed, so pasted captions are how we learn your Reels voice</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="niche" className="field-label">
                      What is your channel about
                    </label>
                    <input
                      id="niche"
                      className="input"
                      placeholder="Budget phone reviews, home cooking, personal finance"
                      value={profile.niche}
                      onChange={(e) => set('niche', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="lang" className="field-label">
                      Language you create in
                    </label>
                    <input
                      id="lang"
                      className="input"
                      value={profile.language}
                      onChange={(e) => set('language', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="cadence" className="field-label">
                      How often you upload
                    </label>
                    <select
                      id="cadence"
                      className="input"
                      value={profile.cadence}
                      onChange={(e) => set('cadence', e.target.value as OnboardingProfile['cadence'])}
                    >
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every two weeks</option>
                      <option value="monthly">About once a month</option>
                      <option value="irregular">No set rhythm</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'earn' && (
            <div className="rise-in">
              <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">How do you earn</h1>
              <p className="mt-2 text-fg-2">
                This decides which tools show up. Affiliate links, disclosures and product cards only appear if you use them
              </p>

              <fieldset className="mt-8">
                <legend className="field-label">Are you in the Amazon Associates program</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice
                    type="radio"
                    name="amazon"
                    checked={profile.amazon.enabled}
                    onChange={() => set('amazon', { ...profile.amazon, enabled: true })}
                    description="Tag links, track earnings, add disclosures"
                  >
                    Yes, I use Amazon links
                  </Choice>
                  <Choice
                    type="radio"
                    name="amazon"
                    checked={!profile.amazon.enabled}
                    onChange={() => set('amazon', { ...profile.amazon, enabled: false })}
                    description="You can turn it on later in Settings"
                  >
                    No, not right now
                  </Choice>
                </div>
              </fieldset>

              {profile.amazon.enabled && (
                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px] rise-in">
                  <div>
                    <label htmlFor="tag" className="field-label">
                      Tracking ID
                    </label>
                    <input
                      id="tag"
                      aria-describedby="tag-hint"
                      className="input font-mono"
                      placeholder="yourname-20"
                      value={profile.amazon.partnerTag}
                      onChange={(e) => set('amazon', { ...profile.amazon, partnerTag: e.target.value.trim() })}
                    />
                    <p id="tag-hint" className="field-hint">Found in Associates Central under Manage tracking IDs</p>
                  </div>
                  <div>
                    <label htmlFor="market" className="field-label">
                      Marketplace
                    </label>
                    <select
                      id="market"
                      className="input"
                      value={profile.amazon.marketplace}
                      onChange={(e) => set('amazon', { ...profile.amazon, marketplace: e.target.value })}
                    >
                      {MARKETPLACES.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <fieldset className="mt-8">
                <legend className="field-label">Other income</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {INCOME.map((label) => (
                    <Choice key={label} checked={profile.otherIncome.includes(label)} onChange={() => toggle('otherIncome', label)}>
                      {label}
                    </Choice>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 'goals' && (
            <div className="rise-in">
              <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">What should we focus on</h1>
              <p id="goals-hint" className="mt-2 text-fg-2">Pick up to three. Lessons and suggestions lean toward these</p>
              <fieldset className="mt-8" aria-describedby="goals-hint">
              <legend className="sr-only">Goals</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <Choice
                    key={g}
                    checked={profile.goals.includes(g)}
                    onChange={() => {
                      if (!profile.goals.includes(g) && profile.goals.length >= 3) return;
                      toggle('goals', g);
                    }}
                  >
                    {g}
                  </Choice>
                ))}
              </div>
              </fieldset>
            </div>
          )}

          {step === 'study' && <StudyRunner onDone={onComplete} onEdit={() => setStep('channel')} />}

          {step !== 'study' && (
            <>
              {error && (
                <div className="mt-6">
                  <ErrorNote>{error}</ErrorNote>
                </div>
              )}
              <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
                {stepIndex > 0 ? (
                  <button className="btn btn-ghost" onClick={() => setStep(STEPS[stepIndex - 1].id)}>
                    <ArrowLeft {...ICON} />
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button className="btn btn-primary" onClick={next} disabled={saving}>
                  {saving && <Spinner size={14} />}
                  {step === 'goals' ? 'Study my channel' : 'Continue'}
                  {!saving && <ArrowRight {...ICON} />}
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

const STUDY_LABELS: Record<string, string> = {
  fetch: 'Reading your uploads',
  video: 'Studying each video: transcript, thumbnail, hook and structure',
  synthesize: 'Learning your voice, packaging and audience',
  plan: 'Building your Brain, lessons and baseline quiz',
};
const ORDER = ['fetch', 'video', 'synthesize', 'plan'];
const MAX_STEP_CALLS = 40;

const StudyRunner: React.FC<{ onDone: () => void; onEdit: () => void }> = ({ onDone, onEdit }) => {
  const [job, setJob] = useState<StudyJob | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);

  const run = async () => {
    setError('');
    try {
      const { jobId } = await api.onboarding.startStudy();
      let current: StudyJob | null = null;
      // Each call runs one short step on the server
      for (let i = 0; i < MAX_STEP_CALLS; i++) {
        const res = await api.onboarding.runStep(jobId);
        current = res.job;
        setJob(current);
        if (current.status !== 'running') break;
      }
      if (current?.status === 'failed') setError(current.error_message || 'The study stopped');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The study stopped');
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, []);

  const results: Record<string, any> = (() => {
    try {
      return JSON.parse(job?.result_json || '{}');
    } catch {
      return {};
    }
  })();
  const currentIndex = job ? (job.status === 'completed' ? ORDER.length : ORDER.indexOf(job.current_step)) : 0;
  const done = job?.status === 'completed';

  return (
    <div className="rise-in">
      <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">
        {done ? 'Your Brain is ready' : 'Studying your channel'}
      </h1>
      <p className="mt-2 text-fg-2">
        {done
          ? 'Here is what we did. Your dashboard shows what we learned and where to start'
          : 'Each video takes a few seconds. Keep this tab open; anything left over is studied later automatically'}
      </p>

      <p className="sr-only" role="status">
        {done ? 'Study complete' : error ? 'The study stopped' : job ? STUDY_LABELS[ORDER[currentIndex]] || '' : 'Starting the study'}
      </p>
      <ol className="mt-8 card divide-y divide-line" aria-label="Study progress">
        {ORDER.map((id, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex && !error ? 'active' : error && i === currentIndex ? 'failed' : 'todo';
          return (
            <li key={id} className="flex items-start gap-3 px-4 py-4">
              <span className="mt-[2px] w-4 h-4 flex items-center justify-center" aria-hidden="true">
                {state === 'done' && <Check {...ICON} className="text-positive" />}
                {state === 'active' && <Spinner size={16} className="text-accent" />}
                {state === 'failed' && <Circle {...ICON} className="text-negative" />}
                {state === 'todo' && <Circle {...ICON} className="text-fg-3" />}
              </span>
              <span className="min-w-0">
                <span className={`block ${state === 'todo' ? 'text-fg-3' : 'text-fg'}`}>
                  {STUDY_LABELS[id]}
                  <span className="sr-only">
                    {state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : state === 'failed' ? ' (failed)' : ' (not started)'}
                  </span>
                </span>
                {typeof results[id] === 'string' && <span className="block mt-[2px] text-[13px] text-fg-2">{results[id]}</span>}
                {id === 'video' && state === 'active' && results.videoProgress?.last && (
                  <span className="block mt-[2px] text-[13px] text-fg-3 truncate">
                    Last studied: {results.videoProgress.last}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-6 flex flex-col gap-4">
          <ErrorNote>{error}</ErrorNote>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={run}>
              <RotateCw {...ICON} />
              Try again
            </button>
            <button className="btn btn-secondary" onClick={onEdit}>
              Edit channel details
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-10 border-t border-line pt-6 flex justify-end">
          <button className="btn btn-primary" onClick={onDone}>
            Open dashboard
            <ArrowRight {...ICON} />
          </button>
        </div>
      )}
    </div>
  );
};
