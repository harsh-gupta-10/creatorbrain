import { ChatToolMenu } from '../components/ChatToolMenu';
import { ChatLinks } from '../components/ChatLinks';
import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, FolderPlus, Check, Package, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { ScriptLanguagePicker } from '../components/ScriptLanguagePicker';
import { PageHeader, ErrorNote, Segmented, Spinner, ICON } from '../components/ui';
import type { Product, Creator } from '../../shared/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  product?: Product | null;
  proposedProject?: { title: string; brief: string } | null;
  isError?: boolean;
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
      content: `${creator?.name ? `Working from ${creator.name}'s published videos and posts${creator.niche ? ` (${creator.niche})` : ''}.` : 'Working from your published videos and posts.'}\n\nDescribe a video you are considering, a product comparison or a retention problem. I can:\n- Suggest angles and hooks in your voice\n- Find live Amazon products and your affiliate links\n- Plan pacing around where viewers usually drop off\n- Turn the idea into a Content Studio project\n\nWhat are you working on?`,
      time: 'Just now',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'brainstorm' | 'script' | 'review' | 'strategy'>('brainstorm');
  const [createdProjectSuccess, setCreatedProjectSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Restore the saved conversation so a refresh or tab change keeps it
  useEffect(() => {
    let alive = true;
    api.chats
      .get('copilot')
      .then(({ messages: saved }) => {
        if (!alive || !saved.length) return;
        setMessages((prev) => {
          return [
            prev[0],
            ...saved.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              time: new Date(m.created_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              product: (m.meta?.detectedProduct as Product | null) || null,
              proposedProject: (m.meta?.proposedProject as Message['proposedProject']) || null,
            })),
          ];
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const clearConversation = async () => {
    if (!window.confirm('Clear this conversation? Saved messages will be deleted')) return;
    try {
      await api.chats.clear('copilot');
      setMessages((prev) => [prev[0]]);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not clear the conversation');
    }
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const starterPrompts = [
    {
      label: 'Compare two phones',
      prompt:
        'I want to review the Motorola Edge 50 Fusion vs Vivo T3 Pro 5G for college students under ₹25k. Give me 3 angles and teardown points.',
      mode: 'brainstorm' as const,
    },
    {
      label: 'Hook for a Mac mini test',
      prompt:
        'Testing the base M4 Mac Mini for 4K video editing. What is the most contrarian hook to test if 256GB SSD is really enough?',
      mode: 'script' as const,
    },
    {
      label: 'Fix the minute 4 drop',
      prompt:
        'My viewers drop off between minutes 3:45 and 5:00. How do I build a forward loop and pattern interrupt for my next phone teardown?',
      mode: 'strategy' as const,
    },
    {
      label: 'Budget gear kit',
      prompt:
        'Suggest a budget YouTube creator gear kit on Amazon India under ₹15,000 that I can recommend to my student audience.',
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
      const history = messages
        .filter((m) => !m.isError)
        .slice(-6)
        .map((m) => ({
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
      const errMsg = err instanceof Error ? err.message : 'Try again';
      const errorMsg: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `Could not get a reply: ${errMsg}`,
        isError: true,
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
      setActionError(null);
      setCreatedProjectSuccess(`Created "${res.project.title}". Opening Content Studio`);
      setTimeout(() => {
        if (onNavigateTab) {
          onNavigateTab('studio');
        }
      }, 1200);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setActionError(`Could not create the project: ${errMsg}`);
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
          <strong key={i} className="font-medium text-fg">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <ChatLinks key={i} text={part} />;
    });
  };

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-[15px] font-medium text-fg mt-3 mb-1">
            {line.replace('### ', '')}
          </h3>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="font-medium text-fg mt-2 mb-1">
            {line.replace('#### ', '')}
          </h4>
        );
      }
      if (line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start gap-2 pl-1">
            <span className="text-fg-3" aria-hidden="true">
              &bull;
            </span>
            <span>{renderInline(line.replace('- ', ''))}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={idx} className="flex items-start gap-2 pl-1">
            <span className="meta leading-5">{line.match(/^\d+\./)?.[0]}</span>
            <span>{renderInline(line.replace(/^\d+\.\s*/, ''))}</span>
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      return <p key={idx}>{renderInline(line)}</p>;
    });
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Copilot"
        description="Talk through a video idea. Answers draw on your published content and live Amazon data"
        actions={
          <>
            <ScriptLanguagePicker />
            {messages.length > 1 && (
              <button className="btn btn-ghost btn-sm" onClick={clearConversation}>
                <Trash2 {...ICON} />
                Clear
              </button>
            )}
            <Segmented
              label="Copilot mode"
              value={activeMode}
              onChange={setActiveMode}
              options={[
                { value: 'brainstorm', label: 'Brainstorm' },
                { value: 'script', label: 'Script' },
                { value: 'review', label: 'Products' },
                { value: 'strategy', label: 'Retention' },
              ]}
            />
          </>
        }
      />

      <div role="status" aria-live="polite">
        {(createdProjectSuccess || actionError) && (
          <div className="mb-4">
            {actionError ? (
              <ErrorNote>{actionError}</ErrorNote>
            ) : (
              <div className="card px-4 py-3 flex items-center gap-2 text-[13px] text-fg">
                <Check {...ICON} className="text-positive shrink-0" />
                {createdProjectSuccess}
              </div>
            )}
          </div>
        )}
      </div>

      <section
        className="panel flex flex-col h-[calc(100vh-240px)] min-h-[480px] overflow-hidden"
        aria-labelledby="copilot-conversation"
      >
        <h2 id="copilot-conversation" className="sr-only">
          Conversation
        </h2>
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-labelledby="copilot-conversation"
          tabIndex={0}
        >
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex flex-col items-end gap-1">
                  <div className="max-w-[85%] rounded-[12px] bg-raised px-4 py-3 text-fg whitespace-pre-wrap">
                    <span className="sr-only">You said: </span>
                    {msg.content}
                  </div>
                  <span className="meta">{msg.time}</span>
                </div>
              ) : (
                <div key={msg.id} className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-fg">Copilot</span>
                    <span className="meta">{msg.time}</span>
                  </div>

                  {msg.isError ? (
                    <ErrorNote>{msg.content}</ErrorNote>
                  ) : (
                    <div className="text-fg-2 leading-[22px] space-y-1">{renderContent(msg.content)}</div>
                  )}

                  {msg.product && (
                    <div className="card p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {msg.product.image_url ? (
                          <img
                            src={msg.product.image_url}
                            alt={msg.product.title || 'Product'}
                            width={48}
                            height={48}
                            loading="lazy"
                            className="w-12 h-12 object-contain rounded-[8px] bg-raised p-1 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-[8px] bg-raised flex items-center justify-center shrink-0">
                            <Package {...ICON} className="text-fg-3" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-fg truncate">{msg.product.title}</div>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="num text-fg-2">{msg.product.price_str}</span>
                            <span className="meta">
                              as of {formatPriceTimestamp(msg.product.price_timestamp)} &middot; {msg.product.asin}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          handleCreateProjectFromChat(
                            `Review: ${msg.product?.title}`,
                            `In-depth review and teardown of ${msg.product?.title} (ASIN: ${msg.product?.asin}) targeting budget tech buyers.`
                          )
                        }
                        className="btn btn-secondary btn-sm shrink-0"
                      >
                        <FolderPlus {...ICON} />
                        Open in Studio
                      </button>
                    </div>
                  )}

                  {msg.proposedProject && (
                    <div className="well p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] leading-4 text-fg-3">Suggested project</div>
                        <div className="font-medium text-fg truncate mt-1">{msg.proposedProject.title}</div>
                      </div>
                      <button
                        onClick={() =>
                          handleCreateProjectFromChat(msg.proposedProject!.title, msg.proposedProject!.brief)
                        }
                        className="btn btn-primary btn-sm shrink-0"
                      >
                        Create project
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {loading && (
              <div className="flex items-center gap-2 text-[13px] text-fg-3" role="status">
                <Spinner />
                Working on your request…
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-line px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.length <= 2 && (
              <div className="flex flex-wrap gap-2">
                {starterPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    title={item.prompt}
                    onClick={() => {
                      setActiveMode(item.mode);
                      handleSend(item.prompt);
                    }}
                    disabled={loading}
                    className="btn btn-secondary btn-sm"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <ChatToolMenu disabled={loading} onChoose={prompt => {
              setInput(prompt);
              textareaRef.current?.focus();
            }} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2 rounded-[12px] border border-line-strong bg-surface p-2 transition-colors focus-within:border-accent"
            >
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a video idea"
                aria-label="Message"
                aria-describedby="copilot-send-hint"
                className="flex-1 bg-transparent border-0 resize-none px-2 py-1 text-fg placeholder:text-fg-3 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send"
                className="btn btn-accent w-9 px-0 shrink-0"
              >
                <ArrowUp {...ICON} />
              </button>
            </form>

            <div className="hidden sm:flex justify-end">
              <span id="copilot-send-hint" className="inline-flex items-center gap-1 text-[12px] text-fg-3">
                <span className="kbd">Enter</span> to send, <span className="kbd">Shift</span>
                <span className="kbd">Enter</span> for a new line
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
