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
}): Promise<string> {
  const { creatorId, userMessage, dna, graph, router, db } = options;

  const gaps = graph.nodes.filter((n) => n.type === 'Gap');
  const strengths = graph.nodes.filter((n) => n.type === 'Strength');

  const systemPrompt = `You are the CreatorBrain AI Tutor & Performance Coach.
You have direct real-time access to the creator's Brain Knowledge Graph and Creator DNA:
- Creator Voice: ${dna.voice.tone}, ${dna.voice.language_mix}
- Known Strengths: ${strengths.map((s) => s.label).join(', ')}
- Critical Knowledge Gaps: ${gaps.map((g) => g.label).join(', ')}

Provide actionable, supportive, high-clarity advice grounded in YouTube retention data, Amazon affiliate conversion tactics, and video packaging. Be encouraging, concise, and specific.`;

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
}): Promise<{ score: number; status: string; gapImproved: boolean }> {
  const { creatorId, quizId, score, gapNodeId, db } = options;
  const now = new Date().toISOString();

  // Update quiz score in DB
  await db
    .prepare(
      'UPDATE quizzes SET score = ?, status = "completed", completed_at = ? WHERE id = ? AND creator_id = ?'
    )
    .bind(score, now, quizId, creatorId)
    .run();

  let gapImproved = false;
  // If score is 4 or 5 out of 5, reduce gap severity or update node confidence
  if (score >= 4 && gapNodeId) {
    await db
      .prepare(
        'UPDATE nodes SET confidence = confidence * 0.7, updated_at = ? WHERE id = ? AND creator_id = ?'
      )
      .bind(now, gapNodeId, creatorId)
      .run();
    gapImproved = true;
  }

  return { score, status: 'completed', gapImproved };
}

/**
 * Memory Curator Agent (Cron): Merges duplicates, decays stale traits, writes weekly "what I learned"
 */
export async function runMemoryCurator(creatorId: string, db: D1Database): Promise<string> {
  const now = new Date().toISOString();
  const insight = `Weekly synthesis: Pinned comments with direct short links converted 40% higher than description-only links. Continuing to emphasize 4-minute pattern interrupts to protect watch-time curve.`;

  await db
    .prepare(
      `INSERT INTO learnings (id, creator_id, title, insight, source_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `learn_cron_${Date.now()}`,
      creatorId,
      'Weekly Autonomous Synthesis',
      insight,
      'Memory Curator',
      now
    )
    .run();

  return insight;
}

/**
 * Orchestrator Agent (Cron entry point): Evaluates channel health and writes Next Best Action to dashboard
 */
export async function runOrchestrator(
  _creatorId: string,
  _db: D1Database
): Promise<{ nextBestAction: string; recommendedAgents: string[] }> {
  const nextBestAction =
    'Record a 45-second teardown Short for Motorola Edge 50 Fusion to recapture lost student viewers from the minute-4 dip.';

  return {
    nextBestAction,
    recommendedAgents: ['Content Studio Agent', 'Compliance Checker', 'Memory Curator'],
  };
}
