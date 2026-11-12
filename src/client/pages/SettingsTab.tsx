import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { ProviderSettings, Creator } from '../../shared/types';

interface SettingsData {
  availableProviders: { claude: boolean; openai: boolean; gemini: boolean; workersAi: boolean };
  providerSettings: ProviderSettings;
  currentDailyUsageUsd: number;
  amazonConfig: { hasCredentials: boolean; partnerTag: string; marketplace: string };
  creator: Creator;
}

export const SettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SettingsData | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI Provider state
  const [preferredGeneral, setPreferredGeneral] = useState<'claude' | 'openai' | 'workers-ai'>('claude');
  const [preferredFast, setPreferredFast] = useState<string>('claude-haiku');
  const [preferredVideo, setPreferredVideo] = useState<string>('gemini');
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState<number>(2.0);
  const [savingAi, setSavingAi] = useState(false);

  // Amazon Credentials state
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [partnerTag, setPartnerTag] = useState('');
  const [marketplace, setMarketplace] = useState('amazon.in');
  const [savingAmazon, setSavingAmazon] = useState(false);

  // Delete modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.settings.getSettings();
      setData(res);
      if (res.providerSettings) {
        setPreferredGeneral(res.providerSettings.preferred_general_provider || 'claude');
        setPreferredFast(res.providerSettings.preferred_fast_provider || 'claude-haiku');
        setPreferredVideo(res.providerSettings.preferred_video_provider || 'gemini');
        setDailyBudgetUsd(res.providerSettings.daily_budget_usd ?? 2.0);
      }
      if (res.amazonConfig) {
        setPartnerTag(res.amazonConfig.partnerTag || '');
        setMarketplace(res.amazonConfig.marketplace || 'amazon.in');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load settings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAi(true);
      setError(null);
      await api.settings.updateProviders({
        preferred_general_provider: preferredGeneral,
        preferred_fast_provider: preferredFast,
        preferred_video_provider: preferredVideo,
        daily_budget_usd: Number(dailyBudgetUsd),
      });
      setSaveSuccess('AI routing settings updated successfully.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update AI settings';
      setError(msg);
    } finally {
      setSavingAi(false);
    }
  };

  const handleSaveAmazon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAmazon(true);
      setError(null);
      const res = await api.settings.updateAmazon({
        accessKey: accessKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
        partnerTag: partnerTag.trim(),
        marketplace,
      });
      setSaveSuccess(res.message || 'Amazon credentials saved securely.');
      setAccessKey('');
      setSecretKey('');
      await fetchSettings();
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save Amazon credentials';
      setError(msg);
    } finally {
      setSavingAmazon(false);
    }
  };

  const handleDeleteData = async () => {
    try {
      setDeleting(true);
      setError(null);
      const res = await api.settings.deleteData();
      alert(res.message || 'Your data has been wiped.');
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete data';
      setError(msg);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading platform settings...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>⚙️</span> System Settings & Privacy
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure multi-provider AI routing, encrypted Amazon credentials, tracking IDs, and manage your data.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm flex items-center gap-2">
          <span>✓</span> {saveSuccess}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-lg text-rose-300 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: AI Provider Status & Preferences */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">AI Provider Router</h2>
              <p className="text-xs text-slate-400">Configure task routing and daily budget limits</p>
            </div>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
              Cloudflare KV Cached
            </span>
          </div>

          {/* Active Provider Indicators */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${data?.availableProviders.claude ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <span className="text-slate-300 font-medium">Claude (Anthropic)</span>
              <span className="ml-auto text-[10px] text-slate-500">{data?.availableProviders.claude ? 'Active' : 'Mock'}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${data?.availableProviders.openai ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <span className="text-slate-300 font-medium">OpenAI</span>
              <span className="ml-auto text-[10px] text-slate-500">{data?.availableProviders.openai ? 'Active' : 'Mock'}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${data?.availableProviders.gemini ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <span className="text-slate-300 font-medium">Gemini 1.5</span>
              <span className="ml-auto text-[10px] text-slate-500">{data?.availableProviders.gemini ? 'Active' : 'Mock'}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${data?.availableProviders.workersAi ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <span className="text-slate-300 font-medium">Workers AI (Llama)</span>
              <span className="ml-auto text-[10px] text-slate-500">{data?.availableProviders.workersAi ? 'Edge' : 'Fallback'}</span>
            </div>
          </div>

          <form onSubmit={handleSaveAi} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Primary Agent & Writing Model
              </label>
              <select
                value={preferredGeneral}
                onChange={(e) => setPreferredGeneral(e.target.value as 'claude' | 'openai' | 'workers-ai')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="claude">Claude 3.5 Sonnet (Anthropic - Recommended)</option>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="workers-ai">Cloudflare Workers AI (Llama 3.1 8B)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Fast Tasks (Captions, Tags, Classification)
              </label>
              <select
                value={preferredFast}
                onChange={(e) => setPreferredFast(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="claude-haiku">Claude 3.5 Haiku (Fast & Precise)</option>
                <option value="openai-mini">OpenAI GPT-4o-mini</option>
                <option value="workers-ai">Cloudflare Workers AI</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Video & Multimodal Analysis
              </label>
              <select
                value={preferredVideo}
                onChange={(e) => setPreferredVideo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini">Google Gemini 1.5 Pro (Direct YouTube URL Vision)</option>
                <option value="claude">Claude 3.5 Sonnet Vision</option>
              </select>
            </div>

            {/* Daily Budget Slider */}
            <div className="pt-2">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-300 font-medium">Daily AI Spend Limit</span>
                <span className="text-indigo-400 font-bold">${dailyBudgetUsd.toFixed(2)} / day</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="10.0"
                step="0.25"
                value={dailyBudgetUsd}
                onChange={(e) => setDailyBudgetUsd(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Today's spend: ${(data?.currentDailyUsageUsd || 0).toFixed(4)}</span>
                <span>Max: $10.00</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAi}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition text-xs flex justify-center items-center gap-1.5"
            >
              {savingAi ? 'Saving AI Config...' : 'Save AI Preferences'}
            </button>
          </form>
        </div>

        {/* Section 2: Amazon BYO Credentials & Affiliate Settings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">Amazon Associates & Creator API</h2>
              <p className="text-xs text-slate-400">Encrypted with AES-GCM (Web Crypto API)</p>
            </div>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                data?.amazonConfig.hasCredentials
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950/70 text-amber-400 border-amber-800'
              }`}
            >
              {data?.amazonConfig.hasCredentials ? 'Encrypted Keys Stored' : 'Using Mock Catalog'}
            </span>
          </div>

          <form onSubmit={handleSaveAmazon} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Amazon Associates Partner Tag
              </label>
              <input
                type="text"
                placeholder="e.g. techkabir-21 or yourtag-20"
                value={partnerTag}
                onChange={(e) => setPartnerTag(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Appended to all generated product links (e.g. <code className="text-slate-400">?tag={partnerTag || 'yourtag-21'}</code>)
              </p>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Marketplace</label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="amazon.in">Amazon India (amazon.in)</option>
                <option value="amazon.com">Amazon US (amazon.com)</option>
                <option value="amazon.co.uk">Amazon UK (amazon.co.uk)</option>
                <option value="amazon.de">Amazon Germany (amazon.de)</option>
                <option value="amazon.ca">Amazon Canada (amazon.ca)</option>
              </select>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <label className="block text-slate-300 font-medium mb-1">
                Amazon PA-API / Creators Access Key <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="password"
                placeholder={data?.amazonConfig.hasCredentials ? '••••••••••••••••••••' : 'AKIAIOSFODNN7EXAMPLE'}
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Amazon PA-API / Creators Secret Key <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="password"
                placeholder={data?.amazonConfig.hasCredentials ? '••••••••••••••••••••••••••••••••' : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Keys are never logged, never returned to browser, and encrypted via Web Crypto AES-GCM 256.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingAmazon}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg font-medium transition text-xs flex justify-center items-center gap-1.5"
            >
              {savingAmazon ? 'Saving Credentials...' : 'Save Amazon Credentials'}
            </button>
          </form>
        </div>
      </div>

      {/* Section 3: Platform & Domain Identifiers */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">Platform Identity & Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-slate-500 block">Creator Handle</span>
            <span className="text-slate-200 font-mono text-sm">@{data?.creator.handle || 'techkabir'}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-slate-500 block">Public Link-in-Bio</span>
            <a
              href={`/@${data?.creator.handle || 'techkabir'}`}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline font-mono text-sm flex items-center gap-1 truncate"
            >
              /@{data?.creator.handle || 'techkabir'} <span>↗</span>
            </a>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-slate-500 block">Short Link Route</span>
            <span className="text-slate-300 font-mono text-sm">/s/:slug</span>
          </div>
        </div>
      </div>

      {/* Section 4: Data Privacy & Wipe ("Delete My Data") */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-rose-300">Danger Zone: Data Wipe</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Permanently delete all Creator DNA nodes, edges, project assets, links, quiz attempts, and encrypted credentials.
            </p>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 rounded-lg text-xs font-semibold transition"
            >
              Delete My Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteData}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-lg shadow-rose-900/30"
              >
                {deleting ? 'Deleting...' : 'Confirm Wipe Everything'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {showDeleteConfirm && (
          <p className="text-xs text-rose-400/90 bg-rose-950/60 p-3 rounded-lg border border-rose-900/50">
            ⚠️ Warning: This action is irreversible. All of your channel analyses, studio scripts, short link analytics, and personalized recommendations will be permanently scrubbed from Cloudflare D1.
          </p>
        )}
      </div>
    </div>
  );
};
