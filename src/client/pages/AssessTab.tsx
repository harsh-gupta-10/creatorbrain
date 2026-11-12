import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Award,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Quiz, QuizQuestion } from '../../shared/types';

export const AssessTab: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submissionResult, setSubmissionResult] = useState<{
    score: number;
    total: number;
    gapImproved: boolean;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const res = await api.assess.getQuizzes();
      setQuizzes(res.quizzes || []);
      if (res.quizzes?.length > 0 && !selectedQuizId) {
        setSelectedQuizId(res.quizzes[0].id);
      }
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuiz = (quiz: Quiz) => {
    setSelectedQuizId(quiz.id);
    setSelectedAnswers({});
    setSubmissionResult(null);
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedQuiz) return;
    const questions: QuizQuestion[] = JSON.parse(selectedQuiz.questions_json);

    // Verify all answered
    if (Object.keys(selectedAnswers).length < questions.length) {
      alert('Please answer all 5 questions before submitting your assessment.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.assess.submitQuiz(selectedQuiz.id, selectedAnswers);
      setSubmissionResult(res);
      await loadQuizzes();
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
  const parsedQuestions: QuizQuestion[] = selectedQuiz
    ? JSON.parse(selectedQuiz.questions_json)
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Knowledge Gap Assessments (Assessor Agent)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            5-question diagnostic quizzes generated from your weakest graph gaps. High scores automatically resolve gaps and update graph weights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">
            {quizzes.filter((q) => q.status === 'completed').length} of {quizzes.length} Completed
          </span>
        </div>
      </div>

      {/* Main Grid: Quiz Switcher List & Quiz Taking Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Quiz Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Assessments
          </span>

          <div className="space-y-2.5">
            {quizzes.map((quiz) => {
              const isSelected = selectedQuiz?.id === quiz.id;
              const isDone = quiz.status === 'completed';
              return (
                <button
                  key={quiz.id}
                  onClick={() => handleSelectQuiz(quiz)}
                  className={`w-full p-4 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                      : isDone
                      ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-bold leading-snug truncate">{quiz.title}</h4>
                    <div className="flex items-center gap-2 text-[10px]">
                      {isDone ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Score: {quiz.score}/5
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Ready to take
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Quiz Content (8 Cols) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-2xl space-y-6">
          {selectedQuiz && (
            <>
              {/* Quiz Header & Result Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Gap Assessment
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">{selectedQuiz.title}</h3>
                </div>

                {submissionResult ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-emerald-300">
                        Score: {submissionResult.score} / {submissionResult.total}
                      </span>
                      {submissionResult.gapImproved && (
                        <span className="text-[10px] text-emerald-400 block font-medium">
                          🎉 Brain Graph gap resolved!
                        </span>
                      )}
                    </div>
                  </div>
                ) : selectedQuiz.status === 'completed' ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-3 py-1.5 rounded-xl">
                    Score: {selectedQuiz.score}/5 (Passed)
                  </span>
                ) : null}
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {parsedQuestions.map((q, qIdx) => {
                  const userAnswer = selectedAnswers[q.id];
                  const hasSubmitted = submissionResult !== null || selectedQuiz.status === 'completed';
                  const isCorrect = userAnswer === q.correctIndex;

                  return (
                    <div
                      key={q.id || qIdx}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                    >
                      <h4 className="text-xs font-bold text-white leading-relaxed">
                        <span className="text-amber-400 font-mono mr-1.5">Q{qIdx + 1}.</span>
                        {q.question}
                      </h4>

                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isOptionSelected = userAnswer === optIdx;
                          const isOptionCorrect = optIdx === q.correctIndex;

                          let btnClasses =
                            'w-full p-2.5 rounded-lg border text-left text-xs font-medium transition-all flex items-center justify-between ';

                          if (hasSubmitted) {
                            if (isOptionCorrect) {
                              btnClasses +=
                                'bg-emerald-950/60 border-emerald-600 text-emerald-200';
                            } else if (isOptionSelected && !isCorrect) {
                              btnClasses += 'bg-rose-950/60 border-rose-700 text-rose-200';
                            } else {
                              btnClasses += 'bg-slate-900 border-slate-800 text-slate-500';
                            }
                          } else {
                            if (isOptionSelected) {
                              btnClasses +=
                                'bg-amber-500/20 border-amber-500 text-amber-200 shadow-sm';
                            } else {
                              btnClasses +=
                                'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300';
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={hasSubmitted}
                              onClick={() => handleSelectOption(q.id, optIdx)}
                              className={btnClasses}
                            >
                              <span>{opt}</span>
                              {hasSubmitted && isOptionCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" />
                              )}
                              {hasSubmitted && isOptionSelected && !isCorrect && (
                                <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation box after submission */}
                      {hasSubmitted && (
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                          <span className="font-semibold text-cyan-400">Explanation:</span>{' '}
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              {selectedQuiz.status !== 'completed' && !submissionResult && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    {isSubmitting ? 'Scoring Assessment...' : 'Submit & Update Graph'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
