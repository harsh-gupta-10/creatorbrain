import React, { useEffect, useState } from 'react';
import { Check, X, ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, ErrorNote, ICON, PageHeader, SectionTitle, Spinner } from '../components/ui';
import type { Quiz, QuizQuestionView } from '../../shared/types';

const parseQuestions = (quiz?: Quiz): QuizQuestionView[] => {
  if (!quiz) return [];
  try {
    return JSON.parse(quiz.questions_json) as QuizQuestionView[];
  } catch {
    return [];
  }
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Could not load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuiz = (quiz: Quiz) => {
    setSelectedQuizId(quiz.id);
    setSelectedAnswers({});
    setSubmissionResult(null);
    setError(null);
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedQuiz) return;
    const questions = parseQuestions(selectedQuiz);

    if (Object.keys(selectedAnswers).length < questions.length) {
      setError(`Answer all ${questions.length} questions before submitting`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.assess.submitQuiz(selectedQuiz.id, selectedAnswers);
      setSubmissionResult(res);
      await loadQuizzes();
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError(err instanceof Error ? err.message : 'Could not submit the quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
  const parsedQuestions = parseQuestions(selectedQuiz);
  const completedCount = quizzes.filter((q) => q.status === 'completed').length;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div>
      <PageHeader
        title="Assess"
        description="Short quizzes built from the gaps in your Brain. A passing score closes the gap and updates the graph."
        actions={
          quizzes.length > 0 ? (
            <span className="meta">
              {completedCount} of {quizzes.length} completed
            </span>
          ) : undefined
        }
      />

      {loading && quizzes.length === 0 ? (
        <div className="card h-40 flex items-center justify-center text-fg-3" role="status">
          <Spinner />
          <span className="sr-only">Loading quizzes</span>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="card">
            <EmptyState
              icon={<ClipboardCheck {...ICON} />}
              title="No quizzes yet"
              description="Quizzes are written from the gaps in your Brain once the channel study finishes."
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Quiz list */}
          <section className="lg:col-span-4">
            <SectionTitle title="Quizzes" meta={String(quizzes.length)} />
            <ol className="card divide-y divide-line overflow-hidden">
              {quizzes.map((quiz, idx) => {
                const isSelected = selectedQuiz?.id === quiz.id;
                const isDone = quiz.status === 'completed';
                const total = parseQuestions(quiz).length;
                return (
                  <li key={quiz.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectQuiz(quiz)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`w-full flex items-center gap-3 px-4 h-12 text-left transition-colors ${
                        isSelected ? 'bg-raised' : 'hover:bg-raised'
                      }`}
                    >
                      <span className="w-5 shrink-0 flex justify-end">
                        {isDone ? (
                          <Check {...ICON} className="text-positive" aria-hidden={false} role="img" aria-label="Completed" />
                        ) : (
                          <span className="meta">{idx + 1}</span>
                        )}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-fg">{quiz.title}</span>
                      <span className="meta shrink-0">
                        {isDone ? `${quiz.score ?? 0}/${total}` : `${total} q`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Active quiz */}
          <section className="lg:col-span-8 card p-6">
            {selectedQuiz && (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-line">
                  <div className="min-w-0">
                    <div className="text-[13px] text-fg-3">
                      <span className="meta">{parsedQuestions.length}</span> questions
                    </div>
                    <h2 className="mt-1 text-[18px] leading-[26px] font-medium text-fg">{selectedQuiz.title}</h2>
                  </div>

                  {submissionResult ? (
                    <div className="text-right shrink-0" role="status">
                      <div className="text-[13px] text-fg-3">Score</div>
                      <div className="text-[24px] leading-8 font-medium num text-fg">
                        {submissionResult.score}
                        <span className="text-fg-3">
                          <span className="sr-only"> out of </span>
                          <span aria-hidden="true">/</span>
                          {submissionResult.total}
                        </span>
                      </div>
                      {submissionResult.gapImproved && (
                        <div className="text-[12px] text-positive">Gap closed in your Brain</div>
                      )}
                    </div>
                  ) : selectedQuiz.status === 'completed' ? (
                    <div className="text-right shrink-0">
                      <div className="text-[13px] text-fg-3">Score</div>
                      <div className="text-[24px] leading-8 font-medium num text-fg">
                        {selectedQuiz.score ?? 0}
                        <span className="text-fg-3">
                          <span className="sr-only"> out of </span>
                          <span aria-hidden="true">/</span>
                          {parsedQuestions.length}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <ol className="mt-6 space-y-8">
                  {parsedQuestions.map((q, qIdx) => {
                    const userAnswer = selectedAnswers[q.id];
                    const hasSubmitted = submissionResult !== null || selectedQuiz.status === 'completed';
                    const isCorrect = userAnswer === q.correctIndex;

                    return (
                      <li key={q.id || qIdx}>
                        <fieldset>
                          <legend className="flex gap-3 text-fg">
                            <span className="meta w-5 shrink-0 pt-0.5">
                              <span className="sr-only">Question </span>
                              {qIdx + 1}
                            </span>
                            <span>{q.question}</span>
                          </legend>

                          <div className="mt-3 ml-8 space-y-2">
                            {q.options.map((opt, optIdx) => {
                              const isOptionSelected = userAnswer === optIdx;
                              const isOptionCorrect = optIdx === q.correctIndex;

                              let state = 'border-line-strong bg-surface text-fg hover:bg-raised';
                              if (hasSubmitted) {
                                if (isOptionCorrect) state = 'border-positive bg-positive-soft text-fg';
                                else if (isOptionSelected && !isCorrect)
                                  state = 'border-negative bg-negative-soft text-fg';
                                else state = 'border-line bg-surface text-fg-3';
                              } else if (isOptionSelected) {
                                state = 'border-accent bg-accent-soft text-fg';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={hasSubmitted}
                                  aria-pressed={isOptionSelected}
                                  onClick={() => handleSelectOption(q.id, optIdx)}
                                  className={`w-full min-h-10 px-3 py-2 rounded-[8px] border text-left text-[14px] flex items-center justify-between gap-3 transition-colors disabled:cursor-default ${state}`}
                                >
                                  <span className="flex items-center gap-3">
                                    <span
                                      className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                                        isOptionSelected && !hasSubmitted
                                          ? 'border-accent'
                                          : 'border-line-strong'
                                      }`}
                                      aria-hidden="true"
                                    >
                                      {isOptionSelected && !hasSubmitted && (
                                        <span className="w-2 h-2 rounded-full bg-accent" />
                                      )}
                                    </span>
                                    {opt}
                                  </span>
                                  {hasSubmitted && isOptionCorrect && (
                                    <Check {...ICON} className="text-positive shrink-0" aria-hidden={false} role="img" aria-label={isOptionSelected ? 'Your answer, correct' : 'Correct answer'} />
                                  )}
                                  {hasSubmitted && isOptionSelected && !isCorrect && (
                                    <X {...ICON} className="text-negative shrink-0" aria-hidden={false} role="img" aria-label="Your answer, incorrect" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {hasSubmitted && q.explanation && (
                            <p className="mt-3 ml-8 text-[13px] text-fg-2">{q.explanation}</p>
                          )}
                        </fieldset>
                      </li>
                    );
                  })}
                </ol>

                {error && (
                  <div className="mt-6">
                    <ErrorNote>{error}</ErrorNote>
                  </div>
                )}

                {selectedQuiz.status !== 'completed' && !submissionResult && (
                  <div className="mt-6 pt-4 border-t border-line flex items-center justify-between gap-4">
                    <span className="meta" aria-live="polite">
                      {answeredCount} of {parsedQuestions.length} answered
                    </span>
                    <button
                      type="button"
                      onClick={handleSubmitQuiz}
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      className="btn btn-primary"
                    >
                      {isSubmitting && <Spinner />}
                      {isSubmitting ? 'Scoring' : 'Submit answers'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
