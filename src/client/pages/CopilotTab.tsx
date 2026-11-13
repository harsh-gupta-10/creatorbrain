import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShoppingBag,
  ArrowRight,
  FolderPlus,
  RefreshCw,
  Lightbulb,
  Film,
  ShieldCheck,
  Check,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Product, Creator } from '../../shared/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  product?: Product | null;
  proposedProject?: { title: string; brief: string } | null;
}

interface CopilotTabProps {
  creator: Creator | null;
  onNavigateTab?: (tabId: string) => void;
}

export const CopilotTab: React.FC<CopilotTabProps> = ({ creator, onNavigateTab }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### Welcome to your Creator Brain Copilot 👋\n\nI am your persistent AI co-strategist, fully synchronized with your **Creator DNA** (${creator?.name || 'Kabir Verma'}, ${creator?.niche || 'Tech & Hardware'}).\n\nTell me about any video idea you're thinking of making—whether it's a rough thought, a product comparison on Amazon, or a retention question. I will:\n- 🎯 Shape it into high-CTR angles in your voice\n- 🔍 Look up live Amazon specs, pricing, and ASINs\n- ⏱️ Architect the 8-minute pacing to prevent minute-4 drop-offs\n- 🎬 Turn it directly into a project in your Content Studio with 1 click!\n\nWhat are you thinking of creating today?`,
      time: 'Just now',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'brainstorm' | 'script' | 'review' | 'strategy'>('brainstorm');
  const [createdProjectSuccess, setCreatedProjectSuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const starterPrompts = [
    {
      label: 'Motorola vs Vivo Review',
      prompt: 'I want to review the Motorola Edge 50 Fusion vs Vivo T3 Pro 5G for college students under ₹25k. Give me 3 viral angles and teardown points.',
      mode: 'brainstorm' as const,
    },
    {
      label: 'M4 Mac Mini 4K Test',
      prompt: 'Testing the base M4 Mac Mini for 4K video editing. What is the most contrarian hook to test if 256GB SSD is really enough?',
      mode: 'script' as const,
    },
    {
      label: 'Fix Minute-4 Dip',
      prompt: 'My viewers drop off between minutes 3:45 and 5:00. How do I build a forward loop and pattern interrupt for my next phone teardown?',
      mode: 'strategy' as const,
    },
    {
      label: 'Amazon Studio Kit',
      prompt: 'Suggest a budget YouTube creator gear kit on Amazon India under ₹15,000 that I can recommend to my student audience.',
      mode: 'review' as const,
    },
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.copilot.chat({
        message: text,
        history,
        mode: activeMode,
      });

      const assistantMsg: Message = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: res.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        product: res.detectedProduct,
        proposedProject: res.proposedProject,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Please retry.';
      const errorMsg: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `⚠️ Encountered an issue connecting to CreatorBrain AI engine: ${errMsg}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProjectFromChat = async (title: string, brief: string) => {
    try {
      const res = await api.studio.createProject({
        title,
        brief,
        status: 'Idea',
      });
      setCreatedProjectSuccess(`Project "${res.project.title}" created! Opening Content Studio...`);
      setTimeout(() => {
        if (onNavigateTab) {
          onNavigateTab('studio');
        }
      }, 1200);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Failed to create project: ${errMsg}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatPriceTimestamp = (ts?: string) => {
    if (!ts) return new Date().toLocaleDateString();
    try {
      const clean = ts.includes('T') ? ts : ts.replace(' ', 'T');
      const d = new Date(clean);
      return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString();
    } catch {
      return new Date().toLocaleDateString();
    }
  };

  const renderInline = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-extrabold text-slate-900 mt-2.5 mb-1 tracking-tight">
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-indigo-700 mt-2 mb-0.5">
            {line.replace('#### ', '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5 text-slate-700">
            <span className="text-indigo-500 font-bold">•</span>
            <span>{renderInline(line.replace('- ', ''))}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5 text-slate-700">
            <span className="text-indigo-600 font-mono font-bold text-[11px]">{line.match(/^\d+\./)?.[0]}</span>
            <span>{renderInline(line.replace(/^\d+\.\s*/, ''))}</span>
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="my-0.5 text-slate-700 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Top Banner / Mode Switcher */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/80">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              CreatorBrain Copilot
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-mono font-bold">
                DNA Synced
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Describe your video ideas in plain words. 13 autonomous agents research specs, build hooks in your voice, and prep your assets.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-xl self-start md:self-auto overflow-x-auto text-xs">
          <button
            onClick={() => setActiveMode('brainstorm')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeMode === 'brainstorm'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Brainstorm
          </button>
          <button
            onClick={() => setActiveMode('script')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeMode === 'script'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-purple-500" />
            Script Architecture
          </button>
          <button
            onClick={() => setActiveMode('review')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeMode === 'review'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />
            Amazon Deals
          </button>
          <button
            onClick={() => setActiveMode('strategy')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeMode === 'strategy'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Retention & Gaps
          </button>
        </div>
      </div>

      {createdProjectSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in shadow-xs font-medium">
          <Check className="w-4 h-4 text-emerald-600" />
          {createdProjectSuccess}
        </div>
      )}

      {/* Main Conversation Canvas */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 overflow-y-auto space-y-6 shadow-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-2xl space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Message Header */}
              <div
                className={`flex items-center gap-2 text-[11px] ${
                  msg.role === 'user' ? 'justify-end text-slate-500' : 'text-slate-500'
                }`}
              >
                <span className="font-semibold text-slate-700">
                  {msg.role === 'user' ? creator?.name || 'You' : 'CreatorBrain Copilot'}
                </span>
                <span>•</span>
                <span>{msg.time}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`p-4 rounded-2xl text-xs leading-relaxed shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none font-medium'
                    : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-none font-sans'
                }`}
              >
                {renderContent(msg.content)}
              </div>

              {/* Embedded Resolved Amazon Product Card */}
              {msg.product && (
                <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={msg.product.image_url}
                      alt={msg.product.title}
                      className="w-12 h-12 object-contain rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                        <span>📦</span> Amazon Creators API Resolved
                      </div>
                      <h4 className="font-semibold text-slate-900 truncate text-xs">{msg.product.title}</h4>
                      <p className="text-[11px] text-slate-600">
                        {msg.product.price_str}{' '}
                        <span className="text-[9px] text-slate-500">
                          (price as of {formatPriceTimestamp(msg.product.price_timestamp)})
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      handleCreateProjectFromChat(
                        `Review: ${msg.product?.title}`,
                        `In-depth review and teardown of ${msg.product?.title} (ASIN: ${msg.product?.asin}) targeting budget tech buyers.`
                      )
                    }
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-xs"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Open in Studio
                  </button>
                </div>
              )}

              {/* Action Button: Create Project from Proposed Concept */}
              {msg.proposedProject && (
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      Proposed Studio Project
                    </span>
                    <span className="text-slate-900 font-semibold">{msg.proposedProject.title}</span>
                  </div>
                  <button
                    onClick={() =>
                      handleCreateProjectFromChat(
                        msg.proposedProject!.title,
                        msg.proposedProject!.brief
                      )
                    }
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-xs"
                  >
                    Create Project →
                  </button>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3.5 items-center text-xs text-indigo-600 animate-pulse py-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <span>CreatorBrain Copilot is analyzing your idea against Creator DNA and Amazon catalog...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompt Chips */}
      {messages.length <= 2 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-indigo-600" />
            Quick Ideas to Try
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {starterPrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActiveMode(item.mode);
                  handleSend(item.prompt);
                }}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 text-left transition text-xs space-y-1 group shadow-xs"
              >
                <div className="font-semibold text-slate-800 group-hover:text-indigo-600 flex items-center justify-between">
                  <span>{item.label}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-1">{item.prompt}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-sm space-y-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Describe your video idea, comparison, or review angle in plain words... (Press Enter to send)`}
            className="flex-1 bg-transparent border-0 text-xs text-slate-900 placeholder-slate-400 focus:outline-none resize-none px-2 py-1 leading-relaxed"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm shadow-indigo-600/20 disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Mode:</span>
            <span className="font-semibold text-indigo-600 capitalize">{activeMode}</span>
            <span>•</span>
            <span>Grounding: Creator DNA + Cloudflare D1 Graph</span>
          </div>
          <span className="hidden sm:inline">Shift + Enter for new line</span>
        </div>
      </form>
    </div>
  );
};
