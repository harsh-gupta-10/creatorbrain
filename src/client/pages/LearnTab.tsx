import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Send,
  GraduationCap,
  Clock,
  BookOpen,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Lesson } from '../../shared/types';

export const LearnTab: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [_loading, setLoading] = useState(true);

  // Tutor Chat State
  const [tutorInput, setTutorInput] = useState('');
  const [tutorMessages, setTutorMessages] = useState<
    { role: 'user' | 'tutor'; text: string; time: string }[]
  >([
    {
      role: 'tutor',
      text: 'Hello! I am your CreatorBrain AI Tutor & Growth Coach. I have analyzed your Brain Knowledge Graph and know your retention drop between minutes 4 and 6. What would you like to work on today?',
      time: 'Just now',
    },
  ]);
  const [isTutorThinking, setIsTutorThinking] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = async (id: string) => {
    try {
      const res = await api.learn.completeLesson(id);
      setLessons(res.lessons || []);
      const comp = (res.lessons || []).filter((l) => l.completed === 1).length;
      setCompletedCount(comp);
      setProgressPercent(Math.round((comp / (res.lessons?.length || 1)) * 100));

      // Auto select next uncompleted lesson
      const next = (res.lessons || []).find((l) => l.completed === 0);
      if (next) setSelectedLessonId(next.id);
    } catch (err) {
      console.error('Failed to complete lesson:', err);
    }
  };

  const handleTutorSend = async (customText?: string) => {
    const textToSend = customText || tutorInput.trim();
    if (!textToSend || isTutorThinking) return;

    if (!customText) setTutorInput('');
    setTutorMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: textToSend,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsTutorThinking(true);
    try {
      const res = await api.learn.tutorChat(textToSend);
      setTutorMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          text: res.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown tutor error';
      setTutorMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          text: `Error connecting to Tutor: ${msg}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
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
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] text-indigo-700 font-medium border border-slate-200/60">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="italic text-slate-800">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  // Helper to cleanly render markdown without raw literal \n and with clean typography
  const renderFormattedMarkdown = (rawContent: string) => {
    if (!rawContent) return null;
    const normalized = rawContent.replace(/\\n/g, '\n');
    const lines = normalized.split('\n');

    return (
      <div className="space-y-3 text-xs leading-relaxed text-slate-700">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm font-bold text-slate-900 pt-3 pb-1 tracking-tight flex items-center gap-2 border-b border-slate-100">
                <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full inline-block shrink-0" />
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }

          if (trimmed.startsWith('#### ')) {
            return (
              <h4 key={idx} className="text-xs font-bold text-slate-800 pt-2 pb-0.5 tracking-tight">
                {trimmed.replace(/^####\s+/, '')}
              </h4>
            );
          }

          if (/^\d+\.\s/.test(trimmed)) {
            const numMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
            if (numMatch) {
              return (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 pl-1 py-0.5">
                  <span className="w-5 h-5 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {numMatch[1]}
                  </span>
                  <div className="flex-1 leading-relaxed">{parseInlineText(numMatch[2])}</div>
                </div>
              );
            }
          }

          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 pl-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span className="leading-relaxed">{parseInlineText(trimmed.replace(/^[-*]\s+/, ''))}</span>
              </div>
            );
          }

          if (trimmed.startsWith('Line 1:') || trimmed.startsWith('Line 2:') || trimmed.startsWith('Line 3:')) {
            return (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-medium">
                <span className="font-bold text-indigo-700 mr-1.5">{trimmed.slice(0, 7)}</span>
                {parseInlineText(trimmed.slice(7))}
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs text-slate-700 leading-relaxed">
              {parseInlineText(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Curriculum Planner & AI Tutor Coach
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalized lessons sequenced by the Curriculum Planner based on your weakest retention and revenue gaps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-800 block">
              Curriculum Progress: {progressPercent}%
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {completedCount} of {lessons.length} lessons mastered
            </span>
          </div>
          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Lessons & Right Tutor Coach */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Lesson Track & Reader (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Lessons Selector Grid */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                Ordered Learning Sequence
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {lessons.length} Modules
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {lessons.map((lesson, idx) => {
                const isSelected = selectedLesson?.id === lesson.id;
                const isCompleted = lesson.completed === 1;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-400/90 text-slate-900 shadow-xs ring-1 ring-indigo-200'
                        : isCompleted
                        ? 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:border-slate-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] font-mono font-bold text-slate-500 bg-slate-50">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate leading-snug">{lesson.title}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{lesson.category}</span>
                        <span>·</span>
                        <span>{lesson.duration_min} min</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Lesson Reader */}
          {selectedLesson && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                      {selectedLesson.category}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" /> {selectedLesson.duration_min} min read
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{selectedLesson.title}</h3>
                </div>

                {selectedLesson.completed === 1 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </span>
                ) : (
                  <button
                    onClick={() => handleCompleteLesson(selectedLesson.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Complete & Unlock Next
                  </button>
                )}
              </div>

              {/* Lesson Body Formatted */}
              <div className="pt-1">
                {renderFormattedMarkdown(selectedLesson.content_markdown)}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Tutor Chat Coach (5 Cols) */}
        <div className="lg:col-span-5 h-[620px] rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-900">AI Tutor & Growth Coach</span>
            </div>
            <span className="text-[10px] text-indigo-700 font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/60">
              Graph Grounded
            </span>
          </div>

          {/* Quick Prompt Chips */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/30 flex items-center gap-1.5 overflow-x-auto">
            {[
              'Fix minute-4 retention dip',
              'Amazon compliance rules',
              'Teardown hooks for student audience',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleTutorSend(chip)}
                className="text-[11px] font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 whitespace-nowrap transition shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/20">
            {tutorMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white font-medium rounded-tr-none shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
              </div>
            ))}
            {isTutorThinking && (
              <div className="flex items-center gap-2 p-3 text-xs text-indigo-700 bg-indigo-50/80 border border-indigo-200 rounded-xl animate-pulse">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Tutor reviewing your Creator DNA & knowledge graph...
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTutorSend();
            }}
            className="p-3 border-t border-slate-100 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
              placeholder="Ask your coach anything about retention, gear, or deals..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={isTutorThinking || !tutorInput.trim()}
              className="p-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-40 transition active:scale-95 shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
