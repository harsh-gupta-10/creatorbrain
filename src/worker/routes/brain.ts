import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';

export const brainRoutes = new Hono<AppEnv>();

brainRoutes.get('/graph', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const graph = await dbClient.getBrainGraph(creator.id);
  const learnings = await dbClient.getLearnings(creator.id, 5);

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
