import { z } from 'zod';

const StoredQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string(),
  options: z.array(z.string()).min(2).max(12),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
});

const StoredQuestionsSchema = z.array(StoredQuestionSchema).min(1).max(50);
const SubmissionSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(11)),
});

export type StoredQuizQuestion = z.infer<typeof StoredQuestionSchema>;

export function parseStoredQuestions(json: string): StoredQuizQuestion[] | null {
  try {
    const parsed: unknown = JSON.parse(json);
    const result = StoredQuestionsSchema.safeParse(parsed);
    if (!result.success || result.data.some((question) => question.correctIndex >= question.options.length)) return null;
    return result.data;
  } catch {
    return null;
  }
}

/** Do not expose answer keys or explanations until the quiz is completed. */
export function questionsForClient(questions: StoredQuizQuestion[], completed: boolean): string {
  if (completed) return JSON.stringify(questions);
  return JSON.stringify(questions.map(({ correctIndex: _correctIndex, explanation: _explanation, ...question }) => question));
}

export function parseQuizSubmission(value: unknown): Record<string, number> | null {
  const parsed = SubmissionSchema.safeParse(value);
  return parsed.success ? parsed.data.answers : null;
}

export function scoreQuiz(questions: StoredQuizQuestion[], answers: Record<string, number>): number | null {
  if (Object.keys(answers).length !== questions.length) return null;
  if (questions.some((question) => answers[question.id] === undefined || answers[question.id] >= question.options.length)) return null;
  return questions.reduce((score, question) => score + Number(answers[question.id] === question.correctIndex), 0);
}
