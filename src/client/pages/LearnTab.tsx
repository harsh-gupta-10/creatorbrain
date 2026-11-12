import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Send,
  GraduationCap,
  Clock,
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
    } catch (err: any) {
      setTutorMessages((prev) => [
        ...prev,
        {
          role: 'tutor',
          text: `Error connecting to Tutor: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTutorThinking(false);
    }
  };

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) || lessons[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            Curriculum Planner & AI Tutor Coach
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Personalized lessons sequenced by the Curriculum Planner based on your weakest retention and revenue gaps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-300 block">
              Curriculum Progress: {progressPercent}%
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {completedCount} of {lessons.length} lessons mastered
            </span>
          </div>
          <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Lessons & Right Tutor Coach */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Lesson Track & Reader (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Lessons Horizontal / Vertical List */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ordered Learning Sequence
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {lessons.map((lesson, idx) => {
                const isSelected = selectedLesson?.id === lesson.id;
                const isCompleted = lesson.completed === 1;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-purple-500/15 border-purple-500 text-white shadow-md'
                        : isCompleted
                        ? 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-mono font-bold text-slate-400">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold truncate leading-snug">{lesson.title}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-mono">
                        <span>{lesson.category}</span> · <span>{lesson.duration_min} min</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Lesson Reader */}
          {selectedLesson && (
            <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {selectedLesson.category}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" /> {selectedLesson.duration_min} min read
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{selectedLesson.title}</h3>
                </div>

                {selectedLesson.completed === 1 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </span>
                ) : (
                  <button
                    onClick={() => handleCompleteLesson(selectedLesson.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Complete & Unlock Next
                  </button>
                )}
              </div>

              {/* Lesson Body */}
              <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed space-y-3 font-normal">
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 leading-relaxed bg-transparent p-0 m-0 border-0">
                  {selectedLesson.content_markdown}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Tutor Chat Coach (5 Cols) */}
        <div className="lg:col-span-5 h-[620px] rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="text-xs font-bold text-white">AI Tutor & Growth Coach</span>
            </div>
            <span className="text-[10px] text-purple-400 font-mono px-2 py-0.5 rounded bg-purple-950/60">
              Graph Grounded
            </span>
          </div>

          {/* Quick Prompt Chips */}
          <div className="p-2 border-b border-slate-800/60 bg-slate-950/20 flex items-center gap-1.5 overflow-x-auto">
            {[
              'Fix minute-4 retention dip',
              'Amazon compliance rules',
              'Teardown hooks for student audience',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleTutorSend(chip)}
                className="text-[10px] font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 whitespace-nowrap transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
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
                      ? 'bg-purple-600 text-white font-medium rounded-tr-none shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none shadow-md'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.time}</span>
              </div>
            ))}
            {isTutorThinking && (
              <div className="flex items-center gap-2 p-3 text-xs text-purple-400 bg-purple-950/20 border border-purple-800/40 rounded-xl animate-pulse">
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
            className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
          >
            <input
              type="text"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
              placeholder="Ask your coach anything about retention, gear, or deals..."
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={isTutorThinking || !tutorInput.trim()}
              className="p-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 disabled:opacity-50 transition active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
