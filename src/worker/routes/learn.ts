import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import { runTutorChat, runCurriculumPlanner } from '../agents/definitions/tutorAndCurriculum';
import { CreatorDNASchema } from '../../shared/types';

export const learnRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI?: any;
  };
}>();

learnRoutes.get('/lessons', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const lessons = await dbClient.getLessons(creator.id);

  const completedCount = lessons.filter((l) => l.completed === 1).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return c.json({ lessons, completedCount, totalCount: lessons.length, progressPercent });
});

learnRoutes.post('/lessons/:id/complete', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

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
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { message } = await c.req.json();
  if (!message) return c.json({ error: 'Message is required' }, 400);

  const dbClient = new DBClient(c.env.DB);
  const graph = await dbClient.getBrainGraph(creator.id);
  const router = new AIRouter(c.env);

  let dna = {
    voice: {
      pace: 'Fast & conversational',
      tone: 'Candid, engineering-grounded',
      catchphrases: ['Let us pop the hood', 'Real talk'],
      language_mix: 'Hinglish',
      hook_formula: 'Teardown in 4 seconds',
    },
    visual: {
      thumbnail_palette: ['#FF0055', '#00F0FF'],
      composition: 'Hero product on left',
      text_overlay_words: 3,
    },
    packaging: {
      title_avg_length: 48,
      title_patterns: ['[Product]: Don\'t Buy Until You See This!'],
      disclosure_position: 'Top 3 lines',
    },
    audience: {
      primary_demographic: '18-34 tech enthusiasts',
      buying_intent: 'High VFM focus',
    },
  };

  if (creator.dna_summary) {
    try {
      dna = CreatorDNASchema.parse(JSON.parse(creator.dna_summary));
    } catch {
      // fallback
    }
  }

  const reply = await runTutorChat({
    creatorId: creator.id,
    userMessage: message,
    dna,
    graph,
    router,
    db: c.env.DB,
  });

  return c.json({ reply });
});
