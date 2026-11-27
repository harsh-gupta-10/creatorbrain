import { Hono } from 'hono';
import { z } from 'zod';
import { brainStates } from '../../shared/creator-workflows';
import type { Project, ProjectAsset } from '../../shared/types';
import type { AppEnv } from '../env';
import { findClips, buildLinkKit, readLinkKit, readPublicationReview, reviewScript } from '../lib/project-workflows';
import { findingKey, findingTypes, readBrainControls, readBrainFindings, weeklyPlan } from '../lib/creator-planning';
import { workspaceDigest, WorkspaceResultBusy } from '../lib/workspace-results';
import { ShortLinkError } from '../lib/short-links';

export const workflowsRoutes = new Hono<AppEnv>();
type ProjectHeader = Pick<Project, 'id' | 'title' | 'brief'>;
type WorkflowEnv = AppEnv & { Variables: AppEnv['Variables'] & { project: ProjectHeader } };
const projectRoutes = new Hono<WorkflowEnv>();

projectRoutes.use('*', async (c, next) => {
  const projectId = c.req.param('id');
  if (!projectId) return c.json({ error: 'Project not found' }, 404);
  const project = await c.env.DB.prepare('SELECT id,title,brief FROM projects WHERE creator_id=? AND id=?')
    .bind(c.get('creator').id, projectId)
    .first<ProjectHeader>();
  if (!project) return c.json({ error: 'Project not found' }, 404);
  c.set('project', project);
  await next();
});
projectRoutes.get('/publication', async (c) =>
  c.json(await readPublicationReview(c.env.DB, c.get('creator').id, c.get('project').id))
);
projectRoutes.put('/publication', async (c) => {
  const input = z
    .object({ contentId: z.string().min(1).max(180).nullable() })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Choose a video from your Library.' }, 400);
  const db = c.env.DB;
  const owner = c.get('creator').id;
  const project = c.get('project');
  if (!input.data.contentId) {
    await db
      .prepare('DELETE FROM project_publications WHERE creator_id=? AND project_id=?')
      .bind(owner, project.id)
      .run();
  } else {
    const video = await db
      .prepare(
        "SELECT id FROM content_items WHERE id=? AND creator_id=? AND platform='youtube' AND published_at IS NOT NULL"
      )
      .bind(input.data.contentId, owner)
      .first();
    if (!video) return c.json({ error: 'Video not found in your Library.' }, 404);
    await db.batch([
      db
        .prepare(
          `INSERT INTO project_publications(project_id,creator_id,content_id) VALUES (?,?,?)
         ON CONFLICT(project_id) DO UPDATE SET content_id=excluded.content_id WHERE project_publications.creator_id=excluded.creator_id`
        )
        .bind(project.id, owner, input.data.contentId),
      db
        .prepare(
          "UPDATE projects SET status='Published',updated_at=? WHERE creator_id=? AND id=? AND status<>'Published'"
        )
        .bind(new Date().toISOString(), owner, project.id),
    ]);
  }
  return c.json(await readPublicationReview(db, owner, project.id));
});
workflowsRoutes.get('/publication-options', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id,title,published_at AS publishedAt FROM content_items WHERE creator_id=? AND platform='youtube' AND published_at IS NOT NULL ORDER BY published_at DESC,id LIMIT 100"
  )
    .bind(c.get('creator').id)
    .all<{ id: string; title: string; publishedAt: string }>();
  return c.json({ videos: results });
});

projectRoutes.get('/link-kit', async (c) =>
  c.json({ links: await readLinkKit(c.env.DB, c.get('creator').id, c.get('project').id) })
);
projectRoutes.post('/link-kit', async (c) => {
  const input = z.object({ destination: z.string().trim().max(2048) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Enter a public HTTP or HTTPS destination.' }, 400);
  try {
    const links = await buildLinkKit(
      c.env,
      c.get('creator').id,
      c.get('project'),
      new URL(c.req.url).origin,
      input.data.destination
    );
    return c.json({ links });
  } catch (error) {
    if (error instanceof ShortLinkError) return c.json({ error: error.message }, error.status);
    throw error;
  }
});

const scriptType = z.enum(['short_script', 'full_script', 'script_outline']);
function scriptAsset(db: D1Database, creatorId: string, projectId: string, type: z.infer<typeof scriptType>) {
  return db
    .prepare('SELECT * FROM assets WHERE creator_id=? AND project_id=? AND type=? ORDER BY updated_at DESC,id LIMIT 1')
    .bind(creatorId, projectId, type)
    .first<ProjectAsset>();
}
projectRoutes.post('/script-review', async (c) => {
  const input = z.object({ type: scriptType }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Choose a saved script.' }, 400);
  const creator = c.get('creator');
  const project = c.get('project');
  const asset = await scriptAsset(c.env.DB, creator.id, project.id, input.data.type);
  if (!asset?.content.trim()) return c.json({ error: 'Draft and save a script in Studio before reviewing it.' }, 404);
  try {
    const { value, reused } = await reviewScript(c.env, creator, project, asset);
    return c.json({ ...value, reused, draftKey: await workspaceDigest([asset.id, asset.content]) });
  } catch (error) {
    if (error instanceof WorkspaceResultBusy) return c.json({ error: error.message }, 409);
    return c.json({ error: 'Script review is unavailable right now. Try again later.' }, 503);
  }
});
projectRoutes.patch('/script-line', async (c) => {
  const input = z
    .object({
      type: scriptType,
      draftKey: z.string().regex(/^[a-f0-9]{64}$/),
      line: z.number().int().min(1).max(180),
      replacement: z
        .string()
        .trim()
        .min(1)
        .max(1000)
        .refine((value) => !/[\r\n]/.test(value)),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Enter one line of replacement text.' }, 400);
  const db = c.env.DB;
  const owner = c.get('creator').id;
  const project = c.get('project').id;
  const { type, draftKey, line, replacement } = input.data;
  const asset = await scriptAsset(db, owner, project, type);
  if (!asset || (await workspaceDigest([asset.id, asset.content])) !== draftKey)
    return c.json({ error: 'The saved script has changed. Review the updated draft before applying edits.' }, 409);
  const lines = asset.content.split('\n');
  if (!lines[line - 1]?.trim()) return c.json({ error: 'That line is no longer available.' }, 409);
  lines[line - 1] = replacement;
  const content = lines.join('\n');
  const id = 'review_' + crypto.randomUUID();
  const now = new Date().toISOString();
  const [created] = await db.batch([
    db
      .prepare(
        `INSERT INTO asset_versions(id,asset_id,version_number,content,prompt_trigger,created_at)
       SELECT ?,a.id,COALESCE((SELECT MAX(v.version_number) FROM asset_versions v WHERE v.asset_id=a.id),0)+1,?,'Applied a script review edit',?
       FROM assets a WHERE a.creator_id=? AND a.project_id=? AND a.id=? AND a.content=?`
      )
      .bind(id, content, now, owner, project, asset.id, asset.content),
    db
      .prepare(
        `UPDATE assets SET content=?,current_version_id=?,updated_at=?
       WHERE id=? AND creator_id=? AND project_id=? AND EXISTS(SELECT 1 FROM asset_versions WHERE id=? AND asset_id=?)`
      )
      .bind(content, id, now, asset.id, owner, project, id, asset.id),
  ]);
  if (!created.meta.changes) return c.json({ error: 'The saved script has changed. Run another review.' }, 409);
  return c.json({ draftKey: await workspaceDigest([asset.id, content]) });
});
workflowsRoutes.route('/project/:id', projectRoutes);

workflowsRoutes.get('/clips', async (c) => {
  const input = z
    .string()
    .trim()
    .max(240)
    .safeParse(c.req.query('query') ?? '');
  if (!input.success) return c.json({ error: 'Use up to 240 characters for your search.' }, 400);
  return c.json({ clips: await findClips(c.env.DB, c.get('creator').id, input.data, !c.get('isSample')) });
});
workflowsRoutes.get('/memory', async (c) => {
  const owner = c.get('creator').id;
  const [findings, controls] = await Promise.all([
    readBrainFindings(c.env.DB, owner),
    readBrainControls(c.env.DB, owner),
  ]);
  return c.json({ findings, controls });
});
workflowsRoutes.put('/memory', async (c) => {
  const input = z
    .object({
      state: z.enum(brainStates),
      nodeId: z.string().min(1).max(180).optional(),
      note: z.string().trim().max(320).default(''),
    })
    .refine((value) => (value.state === 'preference' || value.state === 'corrected' ? Boolean(value.note) : true))
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Enter a preference or select a finding to edit.' }, 400);
  const owner = c.get('creator').id;
  const db = c.env.DB;
  const { state, nodeId, note } = input.data;
  const finding =
    state === 'preference'
      ? { type: 'Preference', label: note }
      : await db
          .prepare(`SELECT type,label FROM nodes WHERE creator_id=? AND id=? AND type IN ${findingTypes}`)
          .bind(owner, nodeId ?? '')
          .first<{ type: string; label: string }>();
  if (!finding) return c.json({ error: 'Brain finding not found.' }, 404);
  const key = await findingKey(finding.type, finding.label);
  const result = await db
    .prepare(
      `INSERT INTO brain_memory_controls(creator_id,memory_key,finding_type,label,state,note,updated_at)
     SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM brain_memory_controls WHERE creator_id=? AND memory_key=?)
       OR (SELECT count(*) FROM brain_memory_controls WHERE creator_id=?)<100
     ON CONFLICT(creator_id,memory_key) DO UPDATE SET state=excluded.state,note=excluded.note,updated_at=excluded.updated_at`
    )
    .bind(owner, key, finding.type, finding.label, state, note, new Date().toISOString(), owner, key, owner)
    .run();
  if (!result.meta.changes) return c.json({ error: 'Remove a saved memory before adding another.' }, 409);
  return c.json({ success: true });
});
workflowsRoutes.delete('/memory/:key', async (c) => {
  await c.env.DB.prepare('DELETE FROM brain_memory_controls WHERE creator_id=? AND memory_key=?')
    .bind(c.get('creator').id, c.req.param('key'))
    .run();
  return c.json({ success: true });
});
workflowsRoutes.get('/weekly-plan', async (c) => c.json({ actions: await weeklyPlan(c.env.DB, c.get('creator').id) }));
workflowsRoutes.post('/weekly-plan/snooze', async (c) => {
  const input = z.object({ id: z.string().min(1).max(220) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Select an action from your plan.' }, 400);
  const owner = c.get('creator').id;
  const plan = await weeklyPlan(c.env.DB, owner);
  if (!plan.some(({ id }) => id === input.data.id))
    return c.json({ error: 'That action is no longer in your plan.' }, 404);
  const until = new Date(Date.now() + 7 * 86400000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO weekly_plan_snoozes(creator_id,action_id,until_date) VALUES (?,?,?)
     ON CONFLICT(creator_id,action_id) DO UPDATE SET until_date=excluded.until_date`
  )
    .bind(owner, input.data.id, until)
    .run();
  return c.json({ actions: await weeklyPlan(c.env.DB, owner) });
});
