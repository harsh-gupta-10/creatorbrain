import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Award,
  ChevronRight,
  AlertCircle,
  HelpCircle,
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
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            Knowledge Gap Assessments (Assessor Agent)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            5-question diagnostic quizzes generated from your weakest graph gaps. High scores automatically resolve gaps and update graph weights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-semibold px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
            {quizzes.filter((q) => q.status === 'completed').length} of {quizzes.length} Completed
          </span>
        </div>
      </div>

      {/* Main Grid: Quiz Switcher List & Quiz Taking Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Quiz Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 px-1">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
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
                      ? 'bg-indigo-50/80 border-indigo-400 text-slate-900 ring-1 ring-indigo-200 shadow-xs'
                      : isDone
                      ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">{quiz.title}</h4>
                    <div className="flex items-center gap-2 text-[10px]">
                      {isDone ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Score: {quiz.score}/5
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-semibold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80">
                          <AlertCircle className="w-3 h-3 text-indigo-600" /> Ready to take
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Quiz Content (8 Cols) */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          {selectedQuiz && (
            <>
              {/* Quiz Header & Result Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    Gap Assessment
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{selectedQuiz.title}</h3>
                </div>

                {submissionResult ? (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-emerald-900">
                        Score: {submissionResult.score} / {submissionResult.total}
                      </span>
                      {submissionResult.gapImproved && (
                        <span className="text-[10px] text-emerald-700 block font-medium">
                          🎉 Brain Graph gap resolved!
                        </span>
                      )}
                    </div>
                  </div>
                ) : selectedQuiz.status === 'completed' ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                    Score: {selectedQuiz.score}/5 (Passed)
                  </span>
                ) : null}
              </div>

              {/* Questions List */}
              <div className="space-y-5">
                {parsedQuestions.map((q, qIdx) => {
                  const userAnswer = selectedAnswers[q.id];
                  const hasSubmitted = submissionResult !== null || selectedQuiz.status === 'completed';
                  const isCorrect = userAnswer === q.correctIndex;

                  return (
                    <div
                      key={q.id || qIdx}
                      className="p-4.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3"
                    >
                      <h4 className="text-xs font-bold text-slate-900 leading-relaxed">
                        <span className="text-indigo-600 font-mono mr-1.5">Q{qIdx + 1}.</span>
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
                                'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold';
                            } else if (isOptionSelected && !isCorrect) {
                              btnClasses += 'bg-rose-50 border-rose-300 text-rose-900';
                            } else {
                              btnClasses += 'bg-white border-slate-200 text-slate-400';
                            }
                          } else {
                            if (isOptionSelected) {
                              btnClasses +=
                                'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold ring-1 ring-indigo-200 shadow-2xs';
                            } else {
                              btnClasses +=
                                'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs';
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
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                              )}
                              {hasSubmitted && isOptionSelected && !isCorrect && (
                                <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation box after submission */}
                      {hasSubmitted && (
                        <div className="p-3 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                          <span className="font-semibold text-indigo-700">Explanation:</span>{' '}
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
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-xs active:scale-95 disabled:opacity-50"
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
