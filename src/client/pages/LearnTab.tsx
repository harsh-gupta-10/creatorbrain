import React, { useEffect, useState } from 'react';
import { Check, Send, BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, ErrorNote, ICON, PageHeader, SectionTitle, Spinner } from '../components/ui';
import type { Lesson } from '../../shared/types';

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const LearnTab: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tutor chat state
  const [tutorInput, setTutorInput] = useState('');
  const [tutorMessages, setTutorMessages] = useState<{ role: 'user' | 'tutor'; text: string; time: string }[]>([
    {
      role: 'tutor',
      text: 'I can answer questions about these lessons, using what the Brain has learned from your published content. Ask about hooks, retention, packaging or affiliate disclosure.',
      time: 'Now',
    },
  ]);
  const [isTutorThinking, setIsTutorThinking] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Restore the saved tutor conversation
  useEffect(() => {
    api.chats
      .get('tutor')
      .then(({ messages: saved }) => {
        if (!saved.length) return;
        setTutorMessages((prev) => [
          prev[0],
          ...saved.map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('tutor' as const),
            text: m.content,
            time: new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          })),
        ]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.learn.getLessons();
      setLessons(res.lessons || []);
      setCompletedCount(res.completedCount || 0);
      setProgressPercent(res.progressPercent || 0);
      if (res.lessons?.length > 0 && !selectedLessonId) {
        setSelectedLessonId(res.lessons[0].id);
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
      setError(err instanceof Error ? err.message : 'Could not load lessons');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = async (id: string) => {
    setCompleting(true);
    setError(null);
    try {
      const res = await api.learn.completeLesson(id);
      setLessons(res.lessons || []);
      const comp = (res.lessons || []).filter((l) => l.completed === 1).length;
      setCompletedCount(comp);
      setProgressPercent(Math.round((comp / (res.lessons?.length || 1)) * 100));

      // Move to the next lesson that is not done yet
      const next = (res.lessons || []).find((l) => l.completed === 0);
      if (next) setSelectedLessonId(next.id);
    } catch (err) {
      console.error('Failed to complete lesson:', err);
      setError(err instanceof Error ? err.message : 'Could not mark the lesson complete');
    } finally {
      setCompleting(false);
    }
  };

  const handleTutorSend = async (customText?: string) => {
    const textToSend = customText || tutorInput.trim();
    if (!textToSend || isTutorThinking) return;

    if (!customText) setTutorInput('');
    setTutorError(null);
    setTutorMessages((prev) => [...prev, { role: 'user', text: textToSend, time: nowTime() }]);

    setIsTutorThinking(true);
    try {
      const res = await api.learn.tutorChat(textToSend);
      setTutorMessages((prev) => [...prev, { role: 'tutor', text: res.reply, time: nowTime() }]);
    } catch (err: unknown) {
      setTutorError(err instanceof Error ? err.message : 'The tutor did not respond');
    } finally {
      setIsTutorThinking(false);
    }
  };

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) || lessons[0];

  const parseInlineText = (text: string): React.ReactNode => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1 py-0.5 rounded-[4px] bg-raised font-mono text-[12px] text-fg">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-medium text-fg">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <span key={i} className="text-fg">
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  // Render lesson markdown without literal \n, in the shared prose rhythm
  const renderFormattedMarkdown = (rawContent: string) => {
    if (!rawContent) return null;
    const normalized = rawContent.replace(/\\n/g, '\n');
    const lines = normalized.split('\n');

    return (
      <div className="space-y-3 text-[14px] leading-[22px] text-fg-2">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="pt-4 text-[15px] font-medium text-fg">
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }

          if (trimmed.startsWith('#### ')) {
            return (
              <h4 key={idx} className="pt-2 font-medium text-fg">
                {trimmed.replace(/^####\s+/, '')}
              </h4>
            );
          }

          if (/^\d+\.\s/.test(trimmed)) {
            const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
            if (numMatch) {
              return (
                <div key={idx} className="flex items-start gap-3">
                  <span className="meta w-4 shrink-0 pt-0.5 text-right">{numMatch[1]}</span>
                  <div className="flex-1">{parseInlineText(numMatch[2])}</div>
                </div>
              );
            }
          }

          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-3">
                <span className="w-4 shrink-0 flex justify-end pt-2">
                  <span className="dot bg-fg-3" aria-hidden="true" />
                </span>
                <span className="flex-1">{parseInlineText(trimmed.replace(/^[-*]\s+/, ''))}</span>
              </div>
            );
          }

          if (trimmed.startsWith('Line 1:') || trimmed.startsWith('Line 2:') || trimmed.startsWith('Line 3:')) {
            return (
              <div key={idx} className="well px-3 py-2">
                <span className="meta mr-2">{trimmed.slice(0, 6)}</span>
                <span className="text-fg">{parseInlineText(trimmed.slice(7))}</span>
              </div>
            );
          }

          return <p key={idx}>{parseInlineText(trimmed)}</p>;
        })}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Learn"
        description="Short lessons ordered by your biggest gaps, with a tutor that knows your channel."
        actions={
          lessons.length > 0 ? (
            <div className="flex items-center gap-3">
              <span className="meta">
                {completedCount} of {lessons.length} done
              </span>
              <div
                className="w-24 h-1 rounded-full bg-sunken overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-label="Course progress"
                aria-valuetext={`${completedCount} of ${lessons.length} lessons done`}
              >
                <div className="h-full bg-fg rounded-full" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {loading && lessons.length === 0 ? (
        <div className="card h-40 flex items-center justify-center text-fg-3" role="status">
          <Spinner />
          <span className="sr-only">Loading lessons</span>
        </div>
      ) : lessons.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen {...ICON} />}
            title="No lessons yet"
            description="Lessons are planned from the gaps in your Brain once the channel study finishes."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lessons and reader */}
          <div className="lg:col-span-7 space-y-6">
            <section>
              <SectionTitle title="Lessons" meta={String(lessons.length)} />
              <ol className="card divide-y divide-line overflow-hidden">
                {lessons.map((lesson, idx) => {
                  const isSelected = selectedLesson?.id === lesson.id;
                  const isCompleted = lesson.completed === 1;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLessonId(lesson.id)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full flex items-center gap-3 px-4 h-12 text-left transition-colors ${
                          isSelected ? 'bg-raised' : 'hover:bg-raised'
                        }`}
                      >
                        <span className="w-5 shrink-0 flex justify-end">
                          {isCompleted ? (
                            <Check {...ICON} className="text-positive" aria-hidden={false} role="img" aria-label="Completed" />
                          ) : (
                            <span className="meta">{idx + 1}</span>
                          )}
                        </span>
                        <span className={`flex-1 min-w-0 truncate ${isCompleted ? 'text-fg-2' : 'text-fg'}`}>
                          {lesson.title}
                        </span>
                        <span className="hidden sm:inline text-[12px] text-fg-3 shrink-0">{lesson.category}</span>
                        <span className="meta w-12 text-right shrink-0">{lesson.duration_min} min</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            {selectedLesson && (
              <article className="card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-line">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13px] text-fg-3">
                      <span>{selectedLesson.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="meta">{selectedLesson.duration_min} min read</span>
                    </div>
                    <h2 className="mt-1 text-[18px] leading-[26px] font-medium text-fg">{selectedLesson.title}</h2>
                  </div>

                  {selectedLesson.completed === 1 ? (
                    <span className="inline-flex items-center gap-2 h-8 text-[13px] text-positive shrink-0">
                      <Check {...ICON} /> Completed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCompleteLesson(selectedLesson.id)}
                      disabled={completing}
                      aria-busy={completing}
                      className="btn btn-primary btn-sm shrink-0"
                    >
                      {completing ? <Spinner /> : <Check {...ICON} />}
                      Mark complete
                    </button>
                  )}
                </div>

                <div className="pt-4">{renderFormattedMarkdown(selectedLesson.content_markdown)}</div>
              </article>
            )}
          </div>

          {/* Tutor */}
          <section className="lg:col-span-5 card h-[620px] flex flex-col overflow-hidden" aria-labelledby="tutor-title">
            <div className="px-4 h-12 border-b border-line flex items-center justify-between">
              <h2 id="tutor-title" className="font-medium text-fg">Tutor</h2>
              <span className="meta">Uses your Brain</span>
            </div>

            <div className="px-4 py-3 border-b border-line flex items-center gap-2 overflow-x-auto" role="group" aria-label="Suggested questions">
              {['How do I keep viewers past the first minute', 'Amazon disclosure rules', 'Review my hooks'].map(
                (chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleTutorSend(chip)}
                    disabled={isTutorThinking}
                    className="tag whitespace-nowrap hover:text-fg transition-colors"
                  >
                    {chip}
                  </button>
                )
              )}
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Tutor conversation"
              tabIndex={0}
            >
              {tutorMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-[12px] px-3 py-2 text-[13px] leading-5 whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-fg text-white' : 'bg-raised text-fg'
                    }`}
                  >
                    <span className="sr-only">{msg.role === 'user' ? 'You said: ' : 'Tutor: '}</span>
                    {msg.text}
                  </div>
                  <span className="meta mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              {isTutorThinking && (
                <div className="flex items-center gap-2 text-[13px] text-fg-3" role="status">
                  <Spinner /> Thinking
                </div>
              )}
              {tutorError && <ErrorNote>{tutorError}</ErrorNote>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTutorSend();
              }}
              className="p-3 border-t border-line flex items-center gap-2"
            >
              <input
                type="text"
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                placeholder="Ask the tutor"
                aria-label="Message the tutor"
                className="input flex-1"
              />
              <button
                type="submit"
                disabled={isTutorThinking || !tutorInput.trim()}
                className="btn btn-primary w-9 px-0"
                aria-label="Send"
              >
                <Send {...ICON} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
