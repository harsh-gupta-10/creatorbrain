import React, { useEffect, useState } from 'react';
import { Copy, Check, Mic, FileCode, Image as ImageIcon, Hash, Wrench } from 'lucide-react';
import { api } from '../lib/api';
import { ScriptLanguagePicker } from '../components/ScriptLanguagePicker';
import { PageHeader, EmptyState, ErrorNote, Spinner, ICON } from '../components/ui';

type ToolType = 'hook' | 'script' | 'thumbnail' | 'caption_hashtag';

const TOOLS: { id: ToolType; label: string; icon: typeof Mic }[] = [
  { id: 'hook', label: 'Hook', icon: Mic },
  { id: 'script', label: 'Script', icon: FileCode },
  { id: 'thumbnail', label: 'Thumbnail', icon: ImageIcon },
  { id: 'caption_hashtag', label: 'Captions', icon: Hash },
];

export const ToolsTab: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>('hook');
  const [topic, setTopic] = useState('');
  const [targetProduct, setTargetProduct] = useState('');
  const [platform, setPlatform] = useState<'youtube' | 'shorts' | 'reels' | 'instagram'>('youtube');
  const [generatedOutput, setGeneratedOutput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Each tool keeps its last result, so switching tabs or refreshing doesn't lose it
  useEffect(() => {
    let alive = true;
    setGeneratedOutput('');
    setSavedAt(null);
    api.chats
      .get(`tools:${activeTool}`)
      .then(({ messages }) => {
        if (!alive) return;
        const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant');
        const lastAsk = [...messages].reverse().find((m) => m.role === 'user');
        if (lastAnswer) {
          setGeneratedOutput(lastAnswer.content);
          setSavedAt(lastAnswer.created_at);
        }
        if (lastAsk) {
          setTopic(lastAsk.content);
          if (lastAsk.meta?.targetProduct) setTargetProduct(String(lastAsk.meta.targetProduct));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeTool]);

  const activeLabel = TOOLS.find((t) => t.id === activeTool)?.label ?? 'Hook';

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.tools.generate({
        toolType: activeTool,
        topic: topic.trim(),
        targetProduct: targetProduct.trim() || undefined,
        platform,
      });
      setGeneratedOutput(res.output);
      setSavedAt(new Date().toISOString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
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
    <div>
      <PageHeader
        title="Tools"
        description="Single-purpose generators for hooks, scripts, thumbnails and captions, written in your voice"
        actions={<ScriptLanguagePicker />}
      />

      <div className="flex flex-wrap gap-1 p-[2px] mb-6 rounded-[8px] bg-raised w-fit" role="group" aria-label="Tool">
        {TOOLS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setActiveTool(tab.id);
                setGeneratedOutput('');
                setError(null);
              }}
              className={`flex items-center gap-2 h-8 px-3 rounded-[6px] text-[13px] transition-colors ${
                isActive ? 'bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-fg-2 hover:text-fg'
              }`}
            >
              <Icon {...ICON} className={isActive ? 'text-fg-2' : 'text-fg-3'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 card p-5">
          <h2 className="text-[15px] font-medium text-fg mb-4">{activeLabel} settings</h2>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="tool-topic">
                Video topic or angle
              </label>
              <textarea
                id="tool-topic"
                rows={3}
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Motorola Edge 50 Fusion, one week in"
                className="input"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="tool-product">
                Product or ASIN <span className="text-fg-3 font-normal">optional</span>
              </label>
              <input
                id="tool-product"
                type="text"
                value={targetProduct}
                onChange={(e) => setTargetProduct(e.target.value)}
                placeholder="Optional"
                className="input"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="tool-platform">
                Platform
              </label>
              <select
                id="tool-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as 'youtube' | 'shorts' | 'reels' | 'instagram')}
                className="input"
              >
                <option value="youtube">YouTube long-form (16:9)</option>
                <option value="shorts">YouTube Shorts (9:16)</option>
                <option value="reels">Instagram Reels (9:16)</option>
                <option value="instagram">Instagram carousel</option>
              </select>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              aria-busy={isGenerating}
              className="btn btn-primary w-full"
            >
              {isGenerating && <Spinner />}
              {isGenerating ? 'Writing' : `Write ${activeLabel.toLowerCase()}`}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 h-[500px] card flex flex-col overflow-hidden">
          <div className="h-12 px-4 border-b border-line flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-fg">
              {activeLabel} output
              {savedAt && (
                <span className="meta font-normal ml-2">
                  saved{' '}
                  {new Date(savedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </h2>
            {generatedOutput && (
              <button onClick={handleCopy} className="btn btn-ghost btn-sm">
                {copied ? <Check {...ICON} className="text-positive" /> : <Copy {...ICON} />}
                <span role="status">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          <p className="sr-only" role="status">
            {isGenerating ? `Writing ${activeLabel.toLowerCase()}` : generatedOutput ? `${activeLabel} ready` : ''}
          </p>
          <div
            className="flex-1 p-5 overflow-y-auto"
            tabIndex={generatedOutput ? 0 : undefined}
            aria-label={`${activeLabel} output`}
          >
            {generatedOutput ? (
              <pre className="font-mono text-[13px] leading-5 text-fg whitespace-pre-wrap select-text">
                {generatedOutput}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={<Wrench {...ICON} />}
                  title="Nothing written yet"
                  description="Set a topic and platform, then write a draft based on your past videos"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
