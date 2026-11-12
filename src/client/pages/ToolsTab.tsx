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
    } catch (err: any) {
      setGeneratedOutput(`Error generating tool output: ${err.message}`);
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
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-400" />
            Creator DNA Power Tools
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Specialized generators for hooks, scripts, thumbnails, and captions strictly encoded with your voice and style.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
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
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Generator Input & Output Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls (5 Cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Configure {activeTool.toUpperCase()} Generation
          </h3>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Video Topic / Angle *
              </label>
              <textarea
                rows={3}
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Motorola Edge 50 Fusion 7-day teardown and camera review..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Product / ASIN (Optional)
              </label>
              <input
                type="text"
                value={targetProduct}
                onChange={(e) => setTargetProduct(e.target.value)}
                placeholder="e.g. Motorola Edge 50 Fusion or Vivo T3 Pro"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Distribution Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
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
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/25 active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Synthesizing with Creator DNA...' : 'Generate with Creator DNA'}
            </button>
          </form>
        </div>

        {/* Right Column: Output Box (7 Cols) */}
        <div className="lg:col-span-7 h-[500px] rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Generated {activeTool.toUpperCase()} Output
            </span>
            {generatedOutput && (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto bg-slate-950/40">
            {generatedOutput ? (
              <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed select-text font-normal">
                {generatedOutput}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Wrench className="w-8 h-8 mb-2 opacity-40 text-cyan-400" />
                <p className="text-xs font-medium text-slate-400">Ready to synthesize</p>
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
