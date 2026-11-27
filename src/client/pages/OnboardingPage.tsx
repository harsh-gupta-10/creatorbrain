import React, { useEffect, useRef, useState } from 'react';
import { Check, ArrowLeft, ArrowRight, SquarePlay, Camera, Languages } from 'lucide-react';
import { api, type OnboardingProfile } from '../lib/api';
import { Logo, Spinner, ErrorNote, ICON, SkipLink } from '../components/ui';
import type { Creator } from '../../shared/types';

interface Props {
  creator: Creator;
  onComplete: () => void;
}

type Step = 'language' | 'channel' | 'earn' | 'goals';
const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 'language', label: 'Language', hint: 'How you create' },
  { id: 'channel', label: 'Your channel', hint: 'What we should study' },
  { id: 'earn', label: 'Earnings', hint: 'Optional setup' },
  { id: 'goals', label: 'Your focus', hint: 'What you want to improve' },
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
  disabled?: boolean;
  children: React.ReactNode;
  description?: string;
}> = ({ checked, onChange, type = 'checkbox', name, disabled = false, children, description }) => (
  <label
    className={`flex items-start gap-3 p-3 rounded-[10px] border transition-colors ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'} ${
      checked
        ? 'border-accent bg-accent-soft'
        : `border-line-strong bg-surface ${disabled ? '' : 'hover:bg-raised'}`
    }`}
  >
    <input
      type={type}
      name={name}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="mt-[2px] accent-[#2f5bea] w-4 h-4"
    />
    <span className="min-w-0">
      <span className="block text-[14px] text-fg">{children}</span>
      {description && <span className="block mt-[2px] text-[13px] text-fg-2">{description}</span>}
    </span>
  </label>
);

export const OnboardingPage: React.FC<Props> = ({ creator, onComplete }) => {
  const [step, setStep] = useState<Step>('language');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstStep = useRef(true);

  const [profile, setProfile] = useState<OnboardingProfile>({
    niche: creator.niche || '',
    language: creator.content_language?.toLowerCase().includes('hindi') ? 'Hindi' : 'English',
    scriptLanguage: creator.script_language === 'hindi' ? 'hindi' : 'english',
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
  const chooseContentLanguage = (language: OnboardingProfile['language']) =>
    setProfile((current) => ({
      ...current,
      language,
      scriptLanguage: language === 'English' ? 'english' : current.scriptLanguage,
    }));
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
    if (step === 'language') return setStep('channel');
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
        // The study runs inside the app with a progress bar, so go there right away
        await api.onboarding.startStudy().catch(() => {});
        onComplete();
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
                  <span
                    className={`block text-[14px] ${active ? 'text-fg font-medium' : done ? 'text-fg' : 'text-fg-3'}`}
                  >
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
          {step === 'language' && (
            <div className="rise-in">
              <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">
                What language do you create in?
              </h1>
              <p className="mt-2 text-fg-2">
                We use this to understand your videos. You can choose a different language for your drafts.
              </p>

              <fieldset className="mt-8">
                <legend className="field-label">Choose your content language</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Choice
                    type="radio"
                    name="content-language"
                    checked={profile.language === 'English'}
                    onChange={() => chooseContentLanguage('English')}
                    description="I speak or publish mainly in English"
                  >
                    English
                  </Choice>
                  <Choice
                    type="radio"
                    name="content-language"
                    checked={profile.language === 'Hindi'}
                    onChange={() => chooseContentLanguage('Hindi')}
                    description="I speak or publish mainly in Hindi"
                  >
                    Hindi
                  </Choice>
                </div>
              </fieldset>

              {profile.language === 'Hindi' ? (
                <fieldset className="mt-8 rise-in">
                  <legend className="field-label">What language should your scripts use?</legend>
                  <p className="field-hint mb-3">Choose English or Hindi written in Devanagari.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Choice
                      type="radio"
                      name="draft-language"
                      checked={profile.scriptLanguage === 'english'}
                      onChange={() => set('scriptLanguage', 'english')}
                      description="Scripts and titles in English"
                    >
                      English
                    </Choice>
                    <Choice
                      type="radio"
                      name="draft-language"
                      checked={profile.scriptLanguage === 'hindi'}
                      onChange={() => set('scriptLanguage', 'hindi')}
                      description="Scripts and titles in Hindi"
                    >
                      हिंदी
                    </Choice>
                  </div>
                  <p className="field-hint mt-3 flex items-start gap-2">
                    <Languages {...ICON} className="mt-0.5 shrink-0" />
                    This sets your generated drafts. CreatorBrain menus and channel insights stay in English; you can
                    change your writing language later in Settings.
                  </p>
                </fieldset>
              ) : (
                <p className="field-hint mt-4">
                  Your drafts will be in English. You can change this later in Settings.
                </p>
              )}
            </div>
          )}

          {step === 'channel' && (
            <div className="rise-in">
              <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">What should we study?</h1>
              <p className="mt-2 text-fg-2">
                Add your YouTube channel, or paste Instagram captions. CreatorBrain only reads your content; it never
                posts for you.
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
                      placeholder="https://www.youtube.com/@yourhandle"
                      value={profile.youtube}
                      onChange={(e) => set('youtube', e.target.value)}
                    />
                  </div>
                  <p id="yt-hint" className="field-hint">
                    Paste your channel link, like https://www.youtube.com/@yourhandle, or just the @handle. If we cannot
                    find it, you can fix it later inside the app
                  </p>
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
                    Recent Instagram captions{' '}
                    <span className="text-fg-3 font-normal">{profile.youtube.trim() ? 'optional' : 'needed without YouTube'}</span>
                  </label>
                  <textarea
                    id="captions"
                    aria-describedby="captions-hint"
                    className="input min-h-[112px]"
                    placeholder="Paste a few captions, separated by a blank line"
                    value={captionsText}
                    onChange={(e) => setCaptionsText(e.target.value)}
                  />
                  <p id="captions-hint" className="field-hint">
                    An Instagram handle alone does not give us your posts. Add captions if you want us to study Instagram content.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="niche" className="field-label">
                      What do you create?
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
                This decides which tools show up. Affiliate links, disclosures and product cards only appear if you use
                them
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
                    <p id="tag-hint" className="field-hint">
                      Found in Associates Central under Manage tracking IDs
                    </p>
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
              {profile.amazon.enabled && (
                <button
                  type="button"
                  className="mt-4 text-[13px] text-fg-2 underline underline-offset-2 hover:text-fg"
                  onClick={() => {
                    set('amazon', { ...profile.amazon, enabled: false });
                    setError('');
                    setStep('goals');
                  }}
                >
                  I don’t have my tracking ID yet — set up Amazon later
                </button>
              )}

              <fieldset className="mt-8">
                <legend className="field-label">Other income</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {INCOME.map((label) => (
                    <Choice
                      key={label}
                      checked={profile.otherIncome.includes(label)}
                      onChange={() => toggle('otherIncome', label)}
                    >
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
              <p id="goals-hint" className="mt-2 text-fg-2">
                Pick up to three. Lessons and suggestions lean toward these. {profile.goals.length}/3 selected.
              </p>
              <fieldset className="mt-8" aria-describedby="goals-hint">
                <legend className="sr-only">Goals</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <Choice
                      key={g}
                      checked={profile.goals.includes(g)}
                      disabled={!profile.goals.includes(g) && profile.goals.length >= 3}
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

          {
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
          }
        </section>
      </main>
    </div>
  );
};
