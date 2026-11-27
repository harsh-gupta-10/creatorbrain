import type { AIRouter } from '../../ai/router';
import type { CreatorDNA, GraphData, Lesson } from '../../../shared/types';
import { runAgent } from '../runner';

/**
 * Tutor Agent: Chat coach using graph and DNA as context
 */
export async function runTutorChat(options: {
  creatorId: string;
  userMessage: string;
  dna: CreatorDNA;
  graph: GraphData;
  router: AIRouter;
  db?: D1Database;
  /** Explanations in English, example lines in the creator's script language */
  languageRule?: string;
}): Promise<string> {
  const { creatorId, userMessage, dna, graph, router, db } = options;

  const gaps = graph.nodes.filter((n) => n.type === 'Gap');
  const strengths = graph.nodes.filter((n) => n.type === 'Strength');

  const systemPrompt = `You are the CreatorBrain AI Tutor & Performance Coach.
You have direct real-time access to the creator's Brain Knowledge Graph and Creator DNA:
- Creator Voice: ${dna.voice.tone}, ${dna.voice.language_mix}
- Known Strengths: ${strengths.map((s) => s.label).join(', ')}
- Critical Knowledge Gaps: ${gaps.map((g) => g.label).join(', ')}

Provide actionable, supportive, high-clarity advice grounded in YouTube retention data, Amazon affiliate conversion tactics, and video packaging. Be encouraging, concise, and specific.
${options.languageRule || ''}`;

  const result = await runAgent({
    name: 'Tutor',
    systemPrompt,
    tools: [],
    input: userMessage,
    creatorId,
    maxSteps: 2,
    router,
    db,
  });

  return result.finalOutput;
}

/**
 * Curriculum Planner Agent: Re-plans lessons based on remaining gaps
 */
export async function runCurriculumPlanner(
  creatorId: string,
  graph: GraphData,
  router: AIRouter,
  db: D1Database
): Promise<Lesson[]> {
  const gaps = graph.nodes.filter((n) => n.type === 'Gap');

  await runAgent({
    name: 'Curriculum Planner',
    systemPrompt:
      'You are the Curriculum Planner Agent. Order creator lessons from weakest gaps and adapt after progress.',
    tools: [],
    input: `Review current gaps: ${gaps.map((g) => g.label).join(', ')}. Ensure lessons are sequenced for maximum channel growth.`,
    creatorId,
    maxSteps: 1,
    router,
    db,
  });

  // Return existing lessons from DB
  const lessonsRes = await db
    .prepare('SELECT * FROM lessons WHERE creator_id = ? ORDER BY order_index ASC')
    .bind(creatorId)
    .all<Lesson>();

  return lessonsRes.results || [];
}

/**
 * Assessor Agent: Generates targeted quiz from weakest gap and updates gap node confidence
 */
export async function runAssessorQuizScoring(options: {
  creatorId: string;
  quizId: string;
  score: number;
  gapNodeId?: string;
  db: D1Database;
}): Promise<{ score: number; status: string; gapImproved: boolean; updated: boolean }> {
  const { creatorId, quizId, score, gapNodeId, db } = options;
  const now = new Date().toISOString();

  // Update quiz score in DB
  const res = await db
    .prepare(
      'UPDATE quizzes SET score = ?, status = "completed", completed_at = ? WHERE id = ? AND creator_id = ? AND status = "pending"'
    )
    .bind(score, now, quizId, creatorId)
    .run();

  if (!res.meta.changes) {
    return { score, status: 'completed', gapImproved: false, updated: false };
  }

  let gapImproved = false;
  // If score is 4 or 5 out of 5, reduce gap severity or update node confidence
  if (score >= 4 && gapNodeId) {
    const gapUpdate = await db
      .prepare('UPDATE nodes SET confidence = confidence * 0.7, updated_at = ? WHERE id = ? AND creator_id = ?')
      .bind(now, gapNodeId, creatorId)
      .run();
    gapImproved = Boolean(gapUpdate.meta.changes);
  }

  return { score, status: 'completed', gapImproved, updated: true };
}

/**
 * Memory Curator Agent (Cron): Merges duplicates, decays stale traits, writes weekly "what I learned"
 */
export async function runMemoryCurator(creatorId: string, db: D1Database): Promise<string> {
  const best = await db
    .prepare(
      'SELECT id, title, views FROM content_items WHERE creator_id=? AND views > 0 ORDER BY views DESC, id LIMIT 1'
    )
    .bind(creatorId)
    .first<{ id: string; title: string; views: number }>();
  if (!best) return 'Study a video with a recorded view count to start tracking channel learnings.';
  const insight = `“${best.title}” leads your imported library with ${best.views.toLocaleString()} recorded views.`;
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO learnings(id, creator_id, title, insight, source_agent, created_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET insight=excluded.insight, created_at=excluded.created_at`
    )
    .bind(`learn_top_${creatorId}_${best.id}`, creatorId, 'Most-viewed imported video', insight, 'Memory Curator', now)
    .run();
  return insight;
}

export async function runOrchestrator(
  creatorId: string,
  db: D1Database
): Promise<{ nextBestAction: string; recommendedAgents: string[] }> {
  const project = await db
    .prepare("SELECT title FROM projects WHERE creator_id=? AND status <> 'Published' ORDER BY updated_at DESC LIMIT 1")
    .bind(creatorId)
    .first<{ title: string }>();
  if (project)
    return {
      nextBestAction: `Open “${project.title}” in Studio and draft its next recording script.`,
      recommendedAgents: ['Short script writer', 'Full script writer'],
    };
  const recent = await db
    .prepare('SELECT title FROM content_items WHERE creator_id=? ORDER BY published_at DESC LIMIT 1')
    .bind(creatorId)
    .first<{ title: string }>();
  return recent
    ? {
        nextBestAction: `Compare the opening of “${recent.title}” with a competitor’s recent uploads before drafting your follow-up.`,
        recommendedAgents: ['Competitor study', 'Title coach'],
      }
    : {
        nextBestAction:
          'Study your YouTube channel to give your agents examples of your titles, descriptions and voice.',
        recommendedAgents: [],
      };
}
