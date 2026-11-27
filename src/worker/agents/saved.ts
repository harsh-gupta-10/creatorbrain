import type { Creator } from '../../shared/types';
import type { SavedAgent } from '../../shared/agents';
import type { Env } from '../env';
import { compose } from './workspace';
import { AIRouter } from '../ai/router';
import { fetchYouTubeChannel, fetchChannelWithDataApi } from '../content/youtube';
import { auditChannel } from '../content/audit';

export class AgentRunError extends Error {
  constructor(
    message: string,
    readonly status: 422 | 503
  ) {
    super(message);
  }
}

export async function runSavedAgent(env: Env, creator: Creator, agent: SavedAgent, context: string) {
  let source = '';
  if (agent.kind === 'competitor') {
    try {
      const channel = env.YOUTUBE_API_KEY
        ? await fetchChannelWithDataApi(agent.channel, env.YOUTUBE_API_KEY, 15).catch(() =>
            fetchYouTubeChannel(agent.channel)
          )
        : await fetchYouTubeChannel(agent.channel);
      const { stats, outliers } = auditChannel(channel);
      source = JSON.stringify({
        channel: channel.title,
        url: channel.url,
        stats,
        outliers: outliers.slice(0, 3),
        recent: channel.videos.slice(0, 5).map((v) => ({ title: v.title, url: v.url, views: v.views })),
      });
    } catch {
      throw new AgentRunError(
        'Could not read public uploads from this YouTube channel. Check the handle or try again later.',
        422
      );
    }
  }
  const instruction =
    agent.kind === 'competitor'
      ? 'Compare this channel’s recent uploads with my stored videos. Cite specific titles and links, distinguish observations from hypotheses, and propose one experiment. '
      : '';
  let report: string;
  try {
    report = await compose(
      env,
      creator,
      new AIRouter(env),
      instruction + agent.focus,
      context,
      agent.kind === 'competitor' ? 'chat' : agent.kind,
      source
    );
  } catch {
    throw new AgentRunError(
      'The writing provider is unavailable or the daily budget has been reached. Try again later.',
      503
    );
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE saved_agents SET report=?,last_run=? WHERE id=? AND creator_id=?').bind(
      report,
      now,
      agent.id,
      creator.id
    ),
    env.DB.prepare(
      `INSERT INTO agent_traces(id,creator_id,agent_name,task_description,step_number,total_steps,tool_called,output_summary,status,created_at)
      VALUES (?,?,?,?,1,1,?,?,'success',?)`
    ).bind(crypto.randomUUID(), creator.id, agent.name, agent.focus, agent.kind, report.slice(0, 300), now),
  ]);
  return { ...agent, report, last_run: now };
}

// Explicit invocation keeps a reusable brief discoverable and runs exactly the agent named in chat.
export async function requestedAgent(env: Env, creator: Creator, message: string, context: string) {
  const match = /^(?:\/run\s+|run (?:my |the )?agent\s+)(.+)$/i.exec(message.trim());
  if (!match) return null;
  const agents = await env.DB.prepare(
    'SELECT id,name,kind,focus,channel,last_run,report FROM saved_agents WHERE creator_id=? AND name=? COLLATE NOCASE LIMIT 2'
  )
    .bind(creator.id, match[1].trim())
    .all<SavedAgent>();
  if (agents.results.length !== 1) return 'Use the Run agent button in Agents to select your saved brief.';
  try {
    return (await runSavedAgent(env, creator, agents.results[0], context)).report;
  } catch (err) {
    if (err instanceof AgentRunError) return err.message;
    throw err;
  }
}
