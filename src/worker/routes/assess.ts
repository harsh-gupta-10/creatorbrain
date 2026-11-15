import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { runAssessorQuizScoring } from '../agents/definitions/tutorAndCurriculum';
import type { Quiz } from '../../shared/types';
import { parseQuizSubmission, parseStoredQuestions, questionsForClient, scoreQuiz } from '../lib/quizzes';

export const assessRoutes = new Hono<AppEnv>();

assessRoutes.get('/quizzes', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const quizzes = await dbClient.getQuizzes(creator.id);

  return c.json({
    quizzes: quizzes.map((quiz) => {
      const questions = parseStoredQuestions(quiz.questions_json);
      return {
        ...quiz,
        questions_json: questions ? questionsForClient(questions, quiz.status === 'completed') : '[]',
      };
    }),
  });
});

assessRoutes.post('/quizzes/:id/submit', async (c) => {
  const creator = c.get('creator');

  const quizId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const answers = parseQuizSubmission(body);
  if (!answers) return c.json({ error: 'Submit a valid answer for each question' }, 400);

  const quiz = await c.env.DB
    .prepare('SELECT * FROM quizzes WHERE id = ? AND creator_id = ?')
    .bind(quizId, creator.id)
    .first<Quiz>();

  if (!quiz) return c.json({ error: 'Quiz not found' }, 404);
  if (quiz.status === 'completed') return c.json({ error: 'This quiz has already been submitted' }, 409);

  const questions = parseStoredQuestions(quiz.questions_json);
  if (!questions) return c.json({ error: 'This quiz is invalid. Refresh your lessons and try again.' }, 409);
  const calculatedScore = scoreQuiz(questions, answers);
  if (calculatedScore === null) return c.json({ error: 'Answer every question with one of its listed options' }, 400);

  const result = await runAssessorQuizScoring({
    creatorId: creator.id,
    quizId,
    score: calculatedScore,
    gapNodeId: quiz.gap_node_id,
    db: c.env.DB,
  });
  if (!result.updated) return c.json({ error: 'This quiz has already been submitted' }, 409);

  return c.json({
    success: true,
    score: calculatedScore,
    total: questions.length,
    gapImproved: result.gapImproved,
    questions,
  });
});
