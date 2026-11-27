import { studioAssignment, studioSuggestions } from '../lib/studio-experiment';
import { findingIdentity, readBrainControls } from '../lib/creator-planning';
import { getChatSuggestions } from '../agents/suggestions';
import { readToolMemory } from '../lib/workspace-evidence';
import { z } from 'zod';
import type { Project } from '../../shared/types';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';

export const brainRoutes = new Hono<AppEnv>();

brainRoutes.get('/graph', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const [original, learnings, toolMemory, controls] = await Promise.all([
    dbClient.getBrainGraph(creator.id),
    dbClient.getLearnings(creator.id, 5),
    readToolMemory(c.env.DB, creator.id),
    readBrainControls(c.env.DB, creator.id),
  ]);
  const overrides = new Map(controls.map((item) => [JSON.stringify(findingIdentity(item.type, item.label)), item]));
  const nodes = original.nodes.flatMap((node) => {
    const override = overrides.get(JSON.stringify(findingIdentity(node.type, node.label)));
    if (override?.state === 'dismissed') return [];
    return [override?.state === 'corrected' ? { ...node, label: override.note, description: override.note } : node];
  });
  const ids = new Set(nodes.map(({ id }) => id));
  const graph = { nodes, edges: original.edges.filter((edge) => ids.has(edge.source_id) && ids.has(edge.target_id)) };

  const nodeCounts = {
    total: graph.nodes.length,
    style: graph.nodes.filter((n) => n.type === 'Style').length,
    strength: graph.nodes.filter((n) => n.type === 'Strength').length,
    gap: graph.nodes.filter((n) => n.type === 'Gap').length,
    audience: graph.nodes.filter((n) => n.type === 'Audience').length,
    topic: graph.nodes.filter((n) => n.type === 'Topic').length,
  };

  return c.json({
    graph,
    learnings,
    toolMemory,
    nodeCounts,
    creatorDNA: creator.dna_summary ? JSON.parse(creator.dna_summary) : null,
  });
});

brainRoutes.get('/learnings', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const learnings = await dbClient.getLearnings(creator.id, 10);
  return c.json({ learnings });
});

brainRoutes.get('/suggestions', async (c) => {
  const creator = c.get('creator');
  const parsed = z
    .string()
    .regex(/^[\w-]{1,80}$/)
    .optional()
    .safeParse(c.req.query('projectId'));
  if (!parsed.success) return c.json({ error: 'Invalid project ID' }, 400);
  const project = parsed.data
    ? await c.env.DB.prepare('SELECT id,title FROM projects WHERE creator_id=? AND id=?')
        .bind(creator.id, parsed.data)
        .first<Pick<Project, 'id' | 'title'>>()
    : null;
  if (parsed.data && !project) return c.json({ error: 'Project not found' }, 404);
  const suggestions = await getChatSuggestions(c.env.DB, creator.id, project || undefined);
  if (!project || c.get('isSample') || !suggestions.some(({ id }) => id === 'brain' || id === 'video') ||
      suggestions.some(({ id }) => id === 'short-link' || id === 'clicks')) return c.json({ suggestions });
  const assignment = await studioAssignment(c.env, creator.id, project.id);
  return c.json(assignment
    ? { suggestions: studioSuggestions(suggestions, assignment.variant), experimentTicket: assignment.ticket }
    : { suggestions });
});
