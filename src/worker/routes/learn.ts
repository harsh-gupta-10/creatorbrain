import { Hono } from 'hono';
import { appendToThread } from '../lib/chats';
import { chatLanguageRule } from '../lib/language';
import { creatorDna } from '../lib/dna';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import { runTutorChat, runCurriculumPlanner } from '../agents/definitions/tutorAndCurriculum';

export const learnRoutes = new Hono<AppEnv>();

learnRoutes.get('/lessons', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const lessons = await dbClient.getLessons(creator.id);

  const completedCount = lessons.filter((l) => l.completed === 1).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return c.json({ lessons, completedCount, totalCount: lessons.length, progressPercent });
});

learnRoutes.post('/lessons/:id/complete', async (c) => {
  const creator = c.get('creator');

  const lessonId = c.req.param('id');
  const dbClient = new DBClient(c.env.DB);
  await dbClient.completeLesson(creator.id, lessonId);

  // Trigger Curriculum Planner to evaluate re-planning
  const graph = await dbClient.getBrainGraph(creator.id);
  const router = new AIRouter(c.env);
  const refreshedLessons = await runCurriculumPlanner(creator.id, graph, router, c.env.DB);

  return c.json({ success: true, lessons: refreshedLessons });
});

learnRoutes.post('/tutor', async (c) => {
  const creator = c.get('creator');

  const { message } = await c.req.json();
  if (!message) return c.json({ error: 'Message is required' }, 400);

  const dbClient = new DBClient(c.env.DB);
  const graph = await dbClient.getBrainGraph(creator.id);
  const router = new AIRouter(c.env);

  const dna = creatorDna(creator);

  const reply = await runTutorChat({
    creatorId: creator.id,
    languageRule: chatLanguageRule(creator),
    userMessage: message,
    dna,
    graph,
    router,
    db: c.env.DB,
  });

  await appendToThread(c.env.DB, creator.id, 'tutor', [
    { role: 'user', content: String(message) },
    { role: 'assistant', content: reply },
  ]);
  return c.json({ reply });
});
