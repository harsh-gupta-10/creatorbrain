import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface OnboardingProps {
  onComplete: () => void;
}

export const OnboardingPage: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [platform, setPlatform] = useState<'youtube' | 'instagram'>('youtube');
  const [urlOrHandle, setUrlOrHandle] = useState('https://youtube.com/@techkabir');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Analysis Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [jobStatus, setJobStatus] = useState<string>('idle');

  // Instagram Lite state
  const [igCaptions, setIgCaptions] = useState(
    '1. Motorola Edge 50 Neo review: Best compact phone under ₹25k? Camera is insane in daylight!\n2. Top 5 gadgets on Amazon under ₹1000 you actually need in 2026.'
  );

  const startAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError('Please check the consent box to allow CreatorBrain agents to analyze your channel history.');
      return;
    }
    if (!urlOrHandle.trim()) {
      setError('Please enter a valid channel URL or handle.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProgress(5);
      setCurrentStep('Channel Scout: Resolving channel and selecting benchmark videos...');
      setJobStatus('running');

      const res = await api.onboarding.start({
        platform,
        urlOrHandle: urlOrHandle.trim(),
        consent: true,
      });

      if (res.jobId) {
        setJobId(res.jobId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start channel onboarding analysis');
      setLoading(false);
      setJobStatus('failed');
    }
  };

  // Poll job status if jobId is active
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.onboarding.getJob(jobId);
        if (res.job) {
          setProgress(res.job.progress_percent || 10);
          setCurrentStep(res.job.current_step || 'Analyzing creator assets...');
          setJobStatus(res.job.status);

          if (res.job.status === 'completed') {
            clearInterval(interval);
            setTimeout(() => {
              onComplete();
            }, 1200);
          } else if (res.job.status === 'failed') {
            clearInterval(interval);
            setError(res.job.error_message || 'Analysis encountered an error.');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Job polling error', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, jobStatus, onComplete]);

  const handleSkipDemo = async () => {
    try {
      setLoading(true);
      await api.auth.demo();
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize demo creator');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="max-w-xl w-full relative z-10 space-y-8">
        {/* Logo & Headline */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold mb-2">
            <span>✨</span> Open Innovation Hackathon 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
            CreatorBrain Onboarding
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Extract your unique Creator DNA. 6 specialized AI agents study your past videos to clone your voice, pacing, packaging, and knowledge graph.
          </p>
        </div>

        {/* Demo Creator Shortcut Banner */}
        <div className="bg-gradient-to-r from-indigo-950/70 to-slate-900 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl shadow-indigo-950/20">
          <div>
            <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <span>⚡</span> Fast Track: Instant Demo Mode
            </div>
            <div className="text-xs text-slate-400">
              Skip setup and explore Kabir Verma's pre-analyzed tech channel (7.5K subs).
            </div>
          </div>
          <button
            onClick={handleSkipDemo}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shrink-0 shadow-md shadow-indigo-600/30"
          >
            Try the Demo →
          </button>
        </div>

        {/* Main Onboarding Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          {error && (
            <div className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {jobStatus === 'running' || jobStatus === 'completed' ? (
            /* Live Progress Visualizer */
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="inline-block animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mb-1" />
                <h3 className="text-base font-bold text-white">Extracting Creator DNA...</h3>
                <p className="text-xs text-indigo-400 font-mono animate-pulse">{currentStep}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 p-0.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Cloudflare Workflow: 6 Agents</span>
                <span>{progress}% complete</span>
              </div>

              {/* Pipeline Agent Checklist */}
              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className={progress >= 20 ? 'text-emerald-400' : 'text-slate-600'}>
                    {progress >= 20 ? '✓' : '○'}
                  </span>
                  <span>Channel Scout: Fetching 30 recent videos, selecting 10 benchmarks</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className={progress >= 40 ? 'text-emerald-400' : 'text-slate-600'}>
                    {progress >= 40 ? '✓' : '○'}
                  </span>
                  <span>Packaging Analyst: Inspecting titles, hooks, CTAs, tags</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className={progress >= 60 ? 'text-emerald-400' : 'text-slate-600'}>
                    {progress >= 60 ? '✓' : '○'}
                  </span>
                  <span>Visual Analyst: Vision scan of 10 thumbnails (faces, contrast, palettes)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className={progress >= 80 ? 'text-emerald-400' : 'text-slate-600'}>
                    {progress >= 80 ? '✓' : '○'}
                  </span>
                  <span>Voice & Edit Analyst: Gemini multimodal video style & pace review</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className={progress >= 100 ? 'text-emerald-400' : 'text-slate-600'}>
                    {progress >= 100 ? '✓' : '○'}
                  </span>
                  <span>Synthesizer: Writing Style, Strength & Gap nodes to D1 graph</span>
                </div>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={startAnalysis} className="space-y-5">
              {/* Platform Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Channel Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform('youtube');
                      setUrlOrHandle('https://youtube.com/@techkabir');
                    }}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition ${
                      platform === 'youtube'
                        ? 'bg-rose-950/40 border-rose-500 text-rose-300 shadow-md shadow-rose-950/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>▶️</span> YouTube Channel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform('instagram');
                      setUrlOrHandle('@techkabir');
                    }}
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition ${
                      platform === 'instagram'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300 shadow-md shadow-purple-950/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>📸</span> Instagram (Lite)
                  </button>
                </div>
              </div>

              {/* URL or Handle Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {platform === 'youtube' ? 'YouTube Channel URL or @Handle' : 'Instagram Handle'}
                </label>
                <input
                  type="text"
                  value={urlOrHandle}
                  onChange={(e) => setUrlOrHandle(e.target.value)}
                  placeholder={platform === 'youtube' ? 'e.g. https://youtube.com/@techkabir' : 'e.g. @techkabir'}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {platform === 'instagram' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Sample Reel Captions <span className="text-slate-500 font-normal">(Lite Path - No Scraping)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={igCaptions}
                    onChange={(e) => setIgCaptions(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Production Instagram Login for Business OAuth is documented in README.
                  </p>
                </div>
              )}

              {/* Consent Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="consent" className="text-xs text-slate-400 leading-snug cursor-pointer">
                  I authorize CreatorBrain to index public metadata and thumbnails to generate personalized Creator DNA and knowledge graph nodes. Data remains private and isolated.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !consent}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-indigo-600/30 flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Starting Agent Pipeline...' : 'Run Creator DNA Pipeline →'}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>Autonomous Agent Team: 13 specialized agents running on Cloudflare Workers Free Tier</p>
          <p>D1 Graph Database • KV Cache & Rate Limits • PA-API Affiliate Engine</p>
        </div>
      </div>
    </div>
  );
};
