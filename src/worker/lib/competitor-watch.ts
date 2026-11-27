import { z } from 'zod';
import type { WatchReview, WatchSnapshot } from '../../shared/creator-workflows';
import type { Env } from '../env';
import { fetchChannelWithDataApi, fetchYouTubeChannel } from '../content/youtube';
import { reuseWorkspaceResult } from './workspace-results';
import { youtubeMoment } from './youtube-moment';

const snapshotSchema = z.object({
  channel: z.string(),
  url: z.url(),
  checkedAt: z.string(),
  uploads: z.array(
    z.object({ id: z.string(), title: z.string(), url: z.url(), views: z.number(), publishedAt: z.string().optional() })
  ),
  outliers: z.array(z.object({ title: z.string(), url: z.url(), ratio: z.number() })),
});

export async function readWatchReview(db: D1Database, creatorId: string, agentId: string): Promise<WatchReview | null> {
  const row = await db
    .prepare('SELECT current_json,previous_json FROM competitor_watch_snapshots WHERE creator_id=? AND agent_id=?')
    .bind(creatorId, agentId)
    .first<{ current_json: string; previous_json: string | null }>();
  if (!row) return null;
  const current: WatchSnapshot = snapshotSchema.parse(JSON.parse(row.current_json));
  const previous: WatchSnapshot | null = row.previous_json ? snapshotSchema.parse(JSON.parse(row.previous_json)) : null;
  const previousIds = new Set(previous?.uploads.map((upload) => upload.id));
  const previousLatest = previous?.uploads.find(({ publishedAt }) => publishedAt)?.publishedAt;
  const newUploads = previousLatest
    ? current.uploads.filter(
        (upload) => upload.publishedAt && upload.publishedAt > previousLatest && !previousIds.has(upload.id)
      )
    : [];
  return { current, previousCheckedAt: previous?.checkedAt ?? null, newUploads };
}

export async function updateWatchReview(env: Env, creatorId: string, agent: { id: string; channel: string }) {
  const latest = await readWatchReview(env.DB, creatorId, agent.id);
  if (latest && Date.now() - Date.parse(latest.current.checkedAt) < 30 * 60 * 1000) return latest;
  const { value } = await reuseWorkspaceResult(
    env.DB,
    creatorId,
    'public-upload-watch-v1',
    [agent.channel.trim().toLowerCase(), latest?.current.checkedAt ?? null],
    snapshotSchema,
    async () => {
      const channel = env.YOUTUBE_API_KEY
        ? await fetchChannelWithDataApi(agent.channel, env.YOUTUBE_API_KEY, 15).catch(() =>
            fetchYouTubeChannel(agent.channel)
          )
        : await fetchYouTubeChannel(agent.channel);
      const uploads = [...channel.videos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 12);
      if (!uploads.length) throw new Error('No public uploads available');
      const counts = uploads.filter((video) => video.views > 0).sort((a, b) => a.views - b.views);
      const median =
        counts.length >= 3
          ? (counts[Math.floor((counts.length - 1) / 2)].views + counts[Math.floor(counts.length / 2)].views) / 2
          : null;
      return {
        channel: channel.title,
        url: channel.url,
        checkedAt: new Date().toISOString(),
        uploads: uploads.map((video) => ({
          id: video.id,
          title: video.title,
          url: youtubeMoment(video.id),
          views: video.views,
          publishedAt: video.publishedAt,
        })),
        outliers:
          median === null
            ? []
            : counts
                .filter((video) => video.views / median >= 1.5)
                .slice(-3)
                .reverse()
                .map((video) => ({
                  title: video.title,
                  url: youtubeMoment(video.id),
                  ratio: video.views / median,
                })),
      };
    },
    1800
  );
  await env.DB.prepare(
    `INSERT INTO competitor_watch_snapshots(agent_id,creator_id,current_json,previous_json)
     SELECT id,creator_id,?,NULL FROM saved_agents WHERE id=? AND creator_id=? AND kind='competitor'
     ON CONFLICT(agent_id) DO UPDATE SET previous_json=competitor_watch_snapshots.current_json,current_json=excluded.current_json
     WHERE competitor_watch_snapshots.creator_id=excluded.creator_id
       AND json_extract(excluded.current_json,'$.checkedAt')>json_extract(competitor_watch_snapshots.current_json,'$.checkedAt')`
  )
    .bind(JSON.stringify(value), agent.id, creatorId)
    .run();
  return readWatchReview(env.DB, creatorId, agent.id);
}
