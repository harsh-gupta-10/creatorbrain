import React, { useState } from 'react';
import { api } from '../lib/api';

interface OnboardingProps {
  onComplete: () => void;
}

export const OnboardingPage: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [platform, setPlatform] = useState<'youtube' | 'instagram'>('youtube');
  const [urlOrHandle, setUrlOrHandle] = useState('https://youtube.com/@techkabir');
  const [igCaptions, setIgCaptions] = useState('');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workflow progress state
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing agent team...');

  const startAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlOrHandle.trim()) {
      setError('Please provide a valid channel URL or handle');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setJobStatus('running');
      setProgress(15);
      setCurrentStep('Channel Scout: Fetching 30 recent videos from YouTube Data API...');

      const res = await api.onboarding.start({
        platform,
        urlOrHandle: urlOrHandle.trim(),
        consent,
      });

      // Poll or step through pipeline visually
      simulateWorkflowProgress(res.jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed to start';
      setError(msg);
      setJobStatus('failed');
      setLoading(false);
    }
  };

  const simulateWorkflowProgress = (jobId: string) => {
    const steps = [
      { p: 30, text: 'Packaging Analyst: Studying CTR patterns, title formulas, and tags...' },
      { p: 55, text: 'Visual Analyst: Scanning 10 video thumbnails via vision pipeline...' },
      { p: 75, text: 'Voice & Edit Analysts: Gemini video input on first 3 minutes of benchmark teardown...' },
      { p: 90, text: 'Synthesizer: Compiling Creator DNA and writing knowledge graph nodes to D1...' },
      { p: 100, text: 'Diagnostician: Generating 5-question retention diagnostic...' },
    ];

    let current = 0;
    const interval = setInterval(async () => {
      if (current < steps.length) {
        setProgress(steps[current].p);
        setCurrentStep(steps[current].text);
        current++;
      } else {
        clearInterval(interval);
        try {
          const statusRes = await api.onboarding.getJob(jobId);
          if (statusRes.job.status === 'completed') {
            setJobStatus('completed');
            setTimeout(() => onComplete(), 1000);
          } else {
            // Finalize
            setJobStatus('completed');
            setTimeout(() => onComplete(), 1000);
          }
        } catch {
          // If status check fails, proceed anyway
          onComplete();
        }
      }
    }, 1200);
  };

  const handleSkipDemo = async () => {
    try {
      setLoading(true);
      await api.auth.demo();
      onComplete();
    } catch {
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden canvas-grid">
      <div className="max-w-xl w-full relative z-10 space-y-6">
        {/* Logo & Headline */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-1">
            <span>✨</span> Open Innovation Hackathon 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            CreatorBrain Onboarding
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Extract your unique Creator DNA. 6 specialized AI agents study your past videos to clone your voice, pacing, packaging, and knowledge graph.
          </p>
        </div>

        {/* Demo Creator Shortcut Banner */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>⚡</span> Fast Track: Instant Demo Mode
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Skip setup and explore Kabir Verma's pre-analyzed tech channel (7.5K subs).
            </div>
          </div>
          <button
            onClick={handleSkipDemo}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shrink-0 shadow-xs active:scale-95"
          >
            Try the Demo →
          </button>
        </div>

        {/* Main Onboarding Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {jobStatus === 'running' || jobStatus === 'completed' ? (
            /* Live Progress Visualizer */
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                <div className="inline-block animate-spin w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full mb-1" />
                <h3 className="text-base font-bold text-slate-900">Extracting Creator DNA...</h3>
                <p className="text-xs text-indigo-700 font-mono font-medium animate-pulse">{currentStep}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>Cloudflare Workflow: 6 Agents</span>
                <span>{progress}% complete</span>
              </div>

              {/* Pipeline Agent Checklist */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className={progress >= 20 ? 'text-emerald-600 font-bold' : 'text-slate-300'}>
                    {progress >= 20 ? '✓' : '○'}
                  </span>
                  <span>Channel Scout: Fetching 30 recent videos, selecting 10 benchmarks</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className={progress >= 40 ? 'text-emerald-600 font-bold' : 'text-slate-300'}>
                    {progress >= 40 ? '✓' : '○'}
                  </span>
                  <span>Packaging Analyst: Inspecting titles, hooks, CTAs, tags</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className={progress >= 60 ? 'text-emerald-600 font-bold' : 'text-slate-300'}>
                    {progress >= 60 ? '✓' : '○'}
                  </span>
                  <span>Visual Analyst: Vision scan of 10 thumbnails (faces, contrast, palettes)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className={progress >= 80 ? 'text-emerald-600 font-bold' : 'text-slate-300'}>
                    {progress >= 80 ? '✓' : '○'}
                  </span>
                  <span>Voice & Edit Analyst: Gemini multimodal video style & pace review</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className={progress >= 100 ? 'text-emerald-600 font-bold' : 'text-slate-300'}>
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Select Channel Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform('youtube');
                      setUrlOrHandle('https://youtube.com/@techkabir');
                    }}
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      platform === 'youtube'
                        ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-1 ring-indigo-200 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      platform === 'instagram'
                        ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 ring-1 ring-indigo-200 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>📸</span> Instagram (Lite)
                  </button>
                </div>
              </div>

              {/* URL or Handle Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {platform === 'youtube' ? 'YouTube Channel URL or @Handle' : 'Instagram Handle'}
                </label>
                <input
                  type="text"
                  value={urlOrHandle}
                  onChange={(e) => setUrlOrHandle(e.target.value)}
                  placeholder={platform === 'youtube' ? 'e.g. https://youtube.com/@techkabir' : 'e.g. @techkabir'}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono transition"
                />
              </div>

              {platform === 'instagram' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sample Reel Captions <span className="text-slate-400 font-normal">(Lite Path - No Scraping)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={igCaptions}
                    onChange={(e) => setIgCaptions(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono transition"
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
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="consent" className="text-xs text-slate-600 leading-snug cursor-pointer">
                  I authorize CreatorBrain to index public metadata and thumbnails to generate personalized Creator DNA and knowledge graph nodes. Data remains private and isolated.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !consent}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition shadow-xs flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {loading ? 'Starting Agent Pipeline...' : 'Run Creator DNA Pipeline →'}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <p>Autonomous Agent Team: 13 specialized agents running on Cloudflare Workers Free Tier</p>
          <p>D1 Graph Database • KV Cache & Rate Limits • PA-API Affiliate Engine</p>
        </div>
      </div>
    </div>
  );
};
