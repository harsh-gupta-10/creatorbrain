import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { runAssessorQuizScoring } from '../agents/definitions/tutorAndCurriculum';
import type { Quiz } from '../../shared/types';

export const assessRoutes = new Hono<AppEnv>();

assessRoutes.get('/quizzes', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const quizzes = await dbClient.getQuizzes(creator.id);

  return c.json({ quizzes });
});

assessRoutes.post('/quizzes/:id/submit', async (c) => {
  const creator = c.get('creator');

  const quizId = c.req.param('id');
  const { answers } = await c.req.json<{ answers: Record<string, number> }>();

  const quiz = await c.env.DB
    .prepare('SELECT * FROM quizzes WHERE id = ? AND creator_id = ?')
    .bind(quizId, creator.id)
    .first<Quiz>();

  if (!quiz) return c.json({ error: 'Quiz not found' }, 404);

  const questions = JSON.parse(quiz.questions_json) as any[];
  let calculatedScore = 0;

  for (const q of questions) {
    if (answers[q.id] === q.correctIndex) {
      calculatedScore++;
    }
  }

  const result = await runAssessorQuizScoring({
    creatorId: creator.id,
    quizId,
    score: calculatedScore,
    gapNodeId: quiz.gap_node_id,
    db: c.env.DB,
  });

  return c.json({
    success: true,
    score: calculatedScore,
    total: questions.length,
    gapImproved: result.gapImproved,
  });
});
