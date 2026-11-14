import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorNote, ICON, PageHeader, Spinner, formatDate } from '../components/ui';

type SettingsData = Awaited<ReturnType<typeof api.settings.getSettings>>;
type Section = 'monetization' | 'ai' | 'amazon' | 'delete';

const MARKETPLACES = ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.ca'];
const OTHER_INCOME = ['Brand sponsorships', 'Own products or courses', 'Memberships', 'Other affiliate programs'];

const errMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Two-column settings row: what it is on the left, the controls on the right */
const SettingsSection: React.FC<{ title: string; description?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="grid grid-cols-1 gap-4 py-8 border-t border-line first:border-t-0 first:pt-0 md:grid-cols-3 md:gap-8">
    <div>
      <h2 className="text-[15px] font-medium text-fg">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-fg-2">{description}</p>}
    </div>
    <div className="md:col-span-2">{children}</div>
  </section>
);

const SavedNote: React.FC<{ show: boolean; text?: string }> = ({ show, text = 'Saved' }) =>
  show ? (
    <span className="inline-flex items-center gap-1 text-[13px] text-positive" role="status">
      <Check {...ICON} /> {text}
    </span>
  ) : null;

export const SettingsTab: React.FC = () => {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({});
  const [saved, setSaved] = useState<{ section: Section; text?: string } | null>(null);

  // Monetization
  const [amazonOn, setAmazonOn] = useState(false);
  const [monTag, setMonTag] = useState('');
  const [monMarketplace, setMonMarketplace] = useState('amazon.com');
  const [otherIncome, setOtherIncome] = useState<string[]>([]);
  const [savingMon, setSavingMon] = useState(false);

  // AI routing
  const [preferredGeneral, setPreferredGeneral] = useState<'claude' | 'openai' | 'workers-ai'>('claude');
  const [preferredFast, setPreferredFast] = useState<string>('claude-haiku');
  const [preferredVideo, setPreferredVideo] = useState<string>('gemini');
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState<number>(2.0);
  const [savingAi, setSavingAi] = useState(false);

  // Amazon API credentials
  const [partnerTag, setPartnerTag] = useState('');
  const [marketplace, setMarketplace] = useState('amazon.com');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [savingAmazon, setSavingAmazon] = useState(false);

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.settings.getSettings();
      setData(res);
      setPreferredGeneral(res.providerSettings?.preferred_general_provider || 'claude');
      setPreferredFast(res.providerSettings?.preferred_fast_provider || 'claude-haiku');
      setPreferredVideo(res.providerSettings?.preferred_video_provider || 'gemini');
      setDailyBudgetUsd(res.providerSettings?.daily_budget_usd || 2.0);
      setPartnerTag(res.amazonConfig?.partnerTag || '');
      setMarketplace(res.amazonConfig?.marketplace || 'amazon.com');

      const m = res.monetization || {};
      setAmazonOn(!!m.amazon);
      setMonTag(m.partnerTag || res.amazonConfig?.partnerTag || '');
      setMonMarketplace(m.marketplace || res.amazonConfig?.marketplace || 'amazon.com');
      setOtherIncome(Array.isArray(m.other) ? m.other : []);
    } catch (err: unknown) {
      setLoadError(errMessage(err, 'Could not load settings'));
    } finally {
      setLoading(false);
    }
  };

  const flashSaved = (section: Section, text?: string) => {
    setSaved({ section, text });
    setTimeout(() => setSaved((s) => (s?.section === section ? null : s)), 3000);
  };

  const setSectionError = (section: Section, msg: string | null) =>
    setErrors((prev) => ({ ...prev, [section]: msg || undefined }));

  const toggleOther = (item: string) =>
    setOtherIncome((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));

  const handleSaveMonetization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingMon(true);
      setSectionError('monetization', null);
      await api.settings.updateMonetization({
        amazon: amazonOn,
        partnerTag: amazonOn ? monTag.trim() : '',
        marketplace: monMarketplace,
        other: otherIncome,
      });
      await fetchSettings();
      flashSaved('monetization');
    } catch (err: unknown) {
      setSectionError('monetization', errMessage(err, 'Could not save monetization'));
    } finally {
      setSavingMon(false);
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAi(true);
      setSectionError('ai', null);
      await api.settings.updateProviders({
        preferred_general_provider: preferredGeneral,
        preferred_fast_provider: preferredFast,
        preferred_video_provider: preferredVideo,
        daily_budget_usd: dailyBudgetUsd,
      });
      await fetchSettings();
      flashSaved('ai');
    } catch (err: unknown) {
      setSectionError('ai', errMessage(err, 'Could not save AI settings'));
    } finally {
      setSavingAi(false);
    }
  };

  const handleSaveAmazon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAmazon(true);
      setSectionError('amazon', null);
      await api.settings.updateAmazon({
        accessKey: accessKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
        partnerTag: partnerTag.trim(),
        marketplace,
      });
      setAccessKey('');
      setSecretKey('');
      await fetchSettings();
      flashSaved('amazon');
    } catch (err: unknown) {
      setSectionError('amazon', errMessage(err, 'Could not save Amazon credentials'));
    } finally {
      setSavingAmazon(false);
    }
  };

  const handleDeleteData = async () => {
    const ok = window.confirm(
      'Delete all of your data? This removes your Brain, projects, links, quiz results and stored keys, and cannot be undone.'
    );
    if (!ok) return;
    try {
      setDeleting(true);
      setSectionError('delete', null);
      await api.settings.deleteData();
      window.location.reload();
    } catch (err: unknown) {
      setSectionError('delete', errMessage(err, 'Could not delete data'));
      setDeleting(false);
    }
  };

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Settings" />
        <div className="card h-40 flex items-center justify-center text-fg-3">
          <Spinner />
        </div>
      </div>
    );
  }

  const creator = data?.creator;
  const providers = data?.availableProviders;
  const providerRows: { name: string; on: boolean; onLabel: string; offLabel: string }[] = [
    { name: 'Claude', on: !!providers?.claude, onLabel: 'Connected', offLabel: 'Not set up' },
    { name: 'OpenAI', on: !!providers?.openai, onLabel: 'Connected', offLabel: 'Not set up' },
    { name: 'Gemini', on: !!providers?.gemini, onLabel: 'Connected', offLabel: 'Not set up' },
    { name: 'Workers AI', on: !!providers?.workersAi, onLabel: 'Available', offLabel: 'Fallback' },
  ];

  return (
    <div>
      <PageHeader title="Settings" description="Your channel, how you earn, which AI models run, and your data." />

      {loadError && (
        <div className="mb-6">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      )}

      {/* Channel */}
      <SettingsSection title="Channel" description="The accounts CreatorBrain studies. Set during onboarding.">
        <dl className="card divide-y divide-line">
          {[
            { label: 'YouTube', value: creator?.youtube_input || null, mono: true },
            {
              label: 'Instagram',
              value: creator?.instagram_handle ? `@${creator.instagram_handle.replace(/^@/, '')}` : null,
              mono: true,
            },
            {
              label: 'Last studied',
              value: creator?.last_studied_at ? formatDate(creator.last_studied_at) : null,
              mono: true,
            },
            { label: 'Handle', value: creator?.handle ? `@${creator.handle}` : null, mono: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-4 h-11">
              <dt className="text-[13px] text-fg-2">{row.label}</dt>
              <dd className={`truncate text-right ${row.value ? 'text-fg' : 'text-fg-3'} ${row.mono ? 'font-mono text-[13px]' : ''}`}>
                {row.value || 'Not set'}
              </dd>
            </div>
          ))}
          {creator?.handle && (
            <div className="flex items-center justify-between gap-4 px-4 h-11">
              <dt className="text-[13px] text-fg-2">Link-in-bio page</dt>
              <dd>
                <a
                  href={`/@${creator.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[13px] text-accent-ink hover:underline"
                >
                  /@{creator.handle}
                  <ArrowUpRight {...ICON} />
                </a>
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 px-4 h-11">
            <dt className="text-[13px] text-fg-2">Short links</dt>
            <dd className="font-mono text-[13px] text-fg">/s/:slug</dd>
          </div>
        </dl>
      </SettingsSection>

      {/* Monetization */}
      <SettingsSection
        title="Monetization"
        description="How you earn from your content. Drafts include affiliate links and disclosures to match."
      >
        <form onSubmit={handleSaveMonetization} className="card p-5 space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div id="amazon-toggle-label" className="font-medium text-fg">
                  Amazon Associates
                </div>
                <p className="mt-1 text-[13px] text-fg-2">Add your tracking ID to product links in scripts and descriptions</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={amazonOn}
                aria-labelledby="amazon-toggle-label"
                onClick={() => setAmazonOn((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  amazonOn ? 'bg-accent' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform ${
                    amazonOn ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {amazonOn && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="mon-tag" className="field-label">
                    Tracking ID
                  </label>
                  <input
                    id="mon-tag"
                    type="text"
                    className="input font-mono"
                    placeholder="yourname-20"
                    value={monTag}
                    onChange={(e) => setMonTag(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="mon-market" className="field-label">
                    Marketplace
                  </label>
                  <select
                    id="mon-market"
                    className="input"
                    value={monMarketplace}
                    onChange={(e) => setMonMarketplace(e.target.value)}
                  >
                    {MARKETPLACES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <fieldset className="pt-6 border-t border-line">
            <legend className="field-label">Other income</legend>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OTHER_INCOME.map((item) => (
                <label key={item} className="flex items-center gap-2 h-8 text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-accent"
                    checked={otherIncome.includes(item)}
                    onChange={() => toggleOther(item)}
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>

          {errors.monetization && <ErrorNote>{errors.monetization}</ErrorNote>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingMon} className="btn btn-primary btn-sm">
              {savingMon && <Spinner />}
              Save monetization
            </button>
            <SavedNote show={saved?.section === 'monetization'} />
          </div>
        </form>
      </SettingsSection>

      {/* AI providers */}
      <SettingsSection title="AI models" description="Which model handles each kind of task, and a daily spending cap.">
        <form onSubmit={handleSaveAi} className="card p-5 space-y-5">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
            {providerRows.map((p) => (
              <li key={p.name} className="flex items-center gap-2 text-[13px]">
                <span className={`dot ${p.on ? 'bg-positive' : 'bg-fg-3'}`} />
                <span className="text-fg">{p.name}</span>
                <span className="meta ml-auto">{p.on ? p.onLabel : p.offLabel}</span>
              </li>
            ))}
          </ul>

          <div className="pt-5 border-t border-line space-y-4">
            <div>
              <label htmlFor="ai-general" className="field-label">
                Writing and agents
              </label>
              <select
                id="ai-general"
                value={preferredGeneral}
                onChange={(e) => setPreferredGeneral(e.target.value as 'claude' | 'openai' | 'workers-ai')}
                className="input"
              >
                <option value="claude">Claude Sonnet (recommended)</option>
                <option value="openai">OpenAI GPT-4o</option>
                <option value="workers-ai">Workers AI, Llama 3.1 8B</option>
              </select>
            </div>

            <div>
              <label htmlFor="ai-fast" className="field-label">
                Fast tasks
              </label>
              <select id="ai-fast" value={preferredFast} onChange={(e) => setPreferredFast(e.target.value)} className="input">
                <option value="claude-haiku">Claude Haiku</option>
                <option value="openai-mini">OpenAI GPT-4o mini</option>
                <option value="workers-ai">Workers AI</option>
              </select>
              <p className="field-hint">Captions, tags and classification</p>
            </div>

            <div>
              <label htmlFor="ai-video" className="field-label">
                Video analysis
              </label>
              <select id="ai-video" value={preferredVideo} onChange={(e) => setPreferredVideo(e.target.value)} className="input">
                <option value="gemini">Gemini 1.5 Pro, reads YouTube URLs directly</option>
                <option value="claude">Claude Sonnet vision</option>
              </select>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="ai-budget" className="field-label">
                  Daily spending cap
                </label>
                <span className="font-mono text-[13px] num text-fg">${dailyBudgetUsd.toFixed(2)} / day</span>
              </div>
              <input
                id="ai-budget"
                type="range"
                min="0.25"
                max="10.0"
                step="0.25"
                value={dailyBudgetUsd}
                onChange={(e) => setDailyBudgetUsd(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <div className="mt-1 flex justify-between">
                <span className="meta">Spent today ${(data?.currentDailyUsageUsd || 0).toFixed(2)}</span>
                <span className="meta">Max $10.00</span>
              </div>
            </div>
          </div>

          {errors.ai && <ErrorNote>{errors.ai}</ErrorNote>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingAi} className="btn btn-primary btn-sm">
              {savingAi && <Spinner />}
              Save AI settings
            </button>
            <SavedNote show={saved?.section === 'ai'} />
          </div>
        </form>
      </SettingsSection>

      {/* Amazon API keys */}
      <SettingsSection
        title="Amazon API keys"
        description="Optional. With your own Product Advertising API keys, product search uses live prices and stock."
      >
        <form onSubmit={handleSaveAmazon} className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-[13px]">
            <span className={`dot ${data?.amazonConfig.hasCredentials ? 'bg-positive' : 'bg-fg-3'}`} />
            <span className="text-fg-2">
              {data?.amazonConfig.hasCredentials ? 'Keys stored, encrypted' : 'No keys stored, using the sample catalog'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="amz-tag" className="field-label">
                Partner tag
              </label>
              <input
                id="amz-tag"
                type="text"
                placeholder="yourname-20"
                value={partnerTag}
                onChange={(e) => setPartnerTag(e.target.value)}
                required
                className="input font-mono"
              />
              <p className="field-hint">
                Added to links as <code>?tag={partnerTag || 'yourname-20'}</code>
              </p>
            </div>
            <div>
              <label htmlFor="amz-market" className="field-label">
                Marketplace
              </label>
              <select id="amz-market" value={marketplace} onChange={(e) => setMarketplace(e.target.value)} className="input">
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="amz-access" className="field-label">
              Access key
            </label>
            <input
              id="amz-access"
              type="password"
              autoComplete="off"
              placeholder={data?.amazonConfig.hasCredentials ? 'Stored, enter a new key to replace it' : 'AKIA…'}
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className="input font-mono"
            />
          </div>

          <div>
            <label htmlFor="amz-secret" className="field-label">
              Secret key
            </label>
            <input
              id="amz-secret"
              type="password"
              autoComplete="off"
              placeholder={data?.amazonConfig.hasCredentials ? 'Stored, enter a new key to replace it' : 'Secret key'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="input font-mono"
            />
            <p className="field-hint">Encrypted with AES-GCM. Keys are never logged or sent back to the browser.</p>
          </div>

          {errors.amazon && <ErrorNote>{errors.amazon}</ErrorNote>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingAmazon} className="btn btn-secondary btn-sm">
              {savingAmazon && <Spinner />}
              Save keys
            </button>
            <SavedNote show={saved?.section === 'amazon'} />
          </div>
        </form>
      </SettingsSection>

      {/* Delete data */}
      <SettingsSection
        title="Delete data"
        description="Permanently removes your Brain, projects, links, quiz results and stored keys."
      >
        <div className="card p-5 space-y-4">
          <p className="text-[13px] text-fg-2">
            Everything CreatorBrain has learned and drafted for you is deleted. This cannot be undone.
          </p>
          {errors.delete && <ErrorNote>{errors.delete}</ErrorNote>}
          <button
            type="button"
            onClick={handleDeleteData}
            disabled={deleting}
            className="btn btn-secondary btn-sm text-negative"
          >
            {deleting && <Spinner />}
            {deleting ? 'Deleting' : 'Delete all data'}
          </button>
        </div>
      </SettingsSection>
    </div>
  );
};
