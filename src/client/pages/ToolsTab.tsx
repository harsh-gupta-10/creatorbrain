import React, { useState } from 'react';
import {
  Wrench,
  Sparkles,
  Copy,
  Check,
  Mic,
  FileCode,
  Image as ImageIcon,
  Hash,
} from 'lucide-react';
import { api } from '../lib/api';

type ToolType = 'hook' | 'script' | 'thumbnail' | 'caption_hashtag';

export const ToolsTab: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>('hook');
  const [topic, setTopic] = useState('Motorola Edge 50 Fusion vs Vivo T3 Pro 5G comparison');
  const [targetProduct, setTargetProduct] = useState('Motorola Edge 50 Fusion');
  const [platform, setPlatform] = useState<'youtube' | 'shorts' | 'reels' | 'instagram'>('youtube');
  const [generatedOutput, setGeneratedOutput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await api.tools.generate({
        toolType: activeTool,
        topic: topic.trim(),
        targetProduct: targetProduct.trim() || undefined,
        platform,
      });
      setGeneratedOutput(res.output);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown generation error';
      setGeneratedOutput(`Error generating tool output: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            Creator DNA Power Tools
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Specialized generators for hooks, scripts, thumbnails, and captions strictly encoded with your voice and style.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
          {[
            { id: 'hook' as const, label: 'Hook', icon: Mic },
            { id: 'script' as const, label: 'Script', icon: FileCode },
            { id: 'thumbnail' as const, label: 'Thumbnail', icon: ImageIcon },
            { id: 'caption_hashtag' as const, label: 'Captions', icon: Hash },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTool(tab.id);
                  setGeneratedOutput('');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-indigo-600" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Generator Input & Output Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Configure {activeTool.toUpperCase()} Generation
          </h3>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Video Topic / Angle *
              </label>
              <textarea
                rows={3}
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Motorola Edge 50 Fusion 7-day teardown and camera review..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 leading-relaxed transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Product / ASIN (Optional)
              </label>
              <input
                type="text"
                value={targetProduct}
                onChange={(e) => setTargetProduct(e.target.value)}
                placeholder="e.g. Motorola Edge 50 Fusion or Vivo T3 Pro"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Distribution Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as 'youtube' | 'shorts' | 'reels' | 'instagram')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="youtube">YouTube Long-Form (16:9)</option>
                <option value="shorts">YouTube Shorts (9:16)</option>
                <option value="reels">Instagram Reels (9:16)</option>
                <option value="instagram">Instagram Feed Carousel</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-xs active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Synthesizing with Creator DNA...' : 'Generate with Creator DNA'}
            </button>
          </form>
        </div>

        {/* Right Column: Output Box (7 Cols) */}
        <div className="lg:col-span-7 h-[500px] rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Generated {activeTool.toUpperCase()} Output
            </span>
            {generatedOutput && (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto bg-slate-50/20">
            {generatedOutput ? (
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed select-text font-normal">
                {generatedOutput}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Wrench className="w-8 h-8 mb-2 opacity-30 text-indigo-600" />
                <p className="text-xs font-medium text-slate-700">Ready to synthesize</p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  Click 'Generate with Creator DNA' to produce content tailored to Kabir's voice and audience.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
