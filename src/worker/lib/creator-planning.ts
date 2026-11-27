import type { BrainControl, BrainFinding, PlanAction } from '../../shared/creator-workflows';
import { workspaceDigest } from './workspace-results';
import { youtubeMoment } from './youtube-moment';

export const findingTypes = "('Strength','Gap','Topic','Style','Hook','Audience')";
export function findingIdentity(type: string, label: string) {
  return [type, label.trim().normalize('NFKC').toLocaleLowerCase()] as const;
}
export function findingKey(type: string, label: string) {
  return workspaceDigest(findingIdentity(type, label));
}
export async function readBrainControls(db: D1Database, creatorId: string) {
  const { results } = await db
    .prepare(
      `SELECT memory_key AS key,finding_type AS type,label,state,note FROM brain_memory_controls
     WHERE creator_id=? ORDER BY updated_at DESC,memory_key LIMIT 100`
    )
    .bind(creatorId)
    .all<BrainControl>();
  return results;
}

export async function readBrainFindings(db: D1Database, creatorId: string) {
  const { results } = await db
    .prepare(
      `SELECT n.id,n.type,n.label,substr(n.description,1,400) AS description,ci.title AS source_title,ci.external_id AS video_id
     FROM nodes n
     LEFT JOIN content_items ci ON ci.creator_id=n.creator_id AND ci.platform='youtube' AND ci.id=COALESCE(n.content_item_id,
       (SELECT v.content_item_id FROM edges e JOIN nodes v ON v.id=CASE WHEN e.source_id=n.id THEN e.target_id ELSE e.source_id END
        WHERE e.creator_id=n.creator_id AND v.creator_id=n.creator_id AND v.type='Video'
         AND (e.source_id=n.id OR e.target_id=n.id) AND v.content_item_id IS NOT NULL
        ORDER BY e.weight DESC,e.id LIMIT 1))
     WHERE n.creator_id=? AND n.type IN ${findingTypes}
     ORDER BY n.confidence DESC,n.updated_at DESC,n.id LIMIT 30`
    )
    .bind(creatorId)
    .all<{
      id: string;
      type: string;
      label: string;
      description: string | null;
      source_title: string | null;
      video_id: string | null;
    }>();
  const unique = new Map<string, BrainFinding>();
  for (const row of results) {
    const key = await findingKey(row.type, row.label);
    const finding = unique.get(key) || {
      id: row.id,
      key,
      type: row.type,
      label: row.label,
      description: row.description,
      sources: [],
    };
    if (row.source_title && row.video_id && finding.sources.length < 4) {
      const url = youtubeMoment(row.video_id);
      if (!finding.sources.some((source) => source.url === url)) finding.sources.push({ title: row.source_title, url });
    }
    unique.set(key, finding);
  }
  return [...unique.values()];
}

export async function weeklyPlan(db: D1Database, creatorId: string): Promise<PlanAction[]> {
  const now = new Date().toISOString();
  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [deals, projects, uploads, ready, snoozes] = await Promise.all([
    db
      .prepare(
        `SELECT id,brand,deliverable,due_date,stage FROM brand_deals WHERE creator_id=?
       AND ((stage='agreed' AND due_date<=?) OR stage='posted')
       ORDER BY stage!='agreed',due_date,id LIMIT 10`
      )
      .bind(creatorId, due)
      .all<{ id: string; brand: string; deliverable: string | null; due_date: string | null; stage: string }>(),
    db
      .prepare(
        `SELECT p.id,p.title,p.status FROM projects p
       LEFT JOIN project_publications pub ON pub.project_id=p.id AND pub.creator_id=p.creator_id
       WHERE p.creator_id=? AND (p.status!='Published' OR pub.project_id IS NULL)
       ORDER BY CASE p.status WHEN 'Edited' THEN 0 WHEN 'Filmed' THEN 1 WHEN 'Scripted' THEN 2 WHEN 'Published' THEN 3 ELSE 4 END, p.updated_at DESC LIMIT 10`
      )
      .bind(creatorId)
      .all<{ id: string; title: string; status: string }>(),
    db
      .prepare("SELECT MAX(published_at) AS latest FROM content_items WHERE creator_id=? AND platform='youtube'")
      .bind(creatorId)
      .first<{ latest: string | null }>(),
    db
      .prepare(
        `SELECT p.id,p.title FROM project_publications pub JOIN projects p ON p.id=pub.project_id AND p.creator_id=pub.creator_id
       JOIN video_review_snapshots s ON s.content_id=pub.content_id AND s.creator_id=pub.creator_id
       WHERE pub.creator_id=? AND julianday(s.sampled_at)>=julianday(?) - 7
       ORDER BY s.sampled_at DESC LIMIT 5`
      )
      .bind(creatorId, now)
      .all<{ id: string; title: string }>(),
    db
      .prepare('SELECT action_id FROM weekly_plan_snoozes WHERE creator_id=? AND until_date>?')
      .bind(creatorId, now)
      .all<{ action_id: string }>(),
  ]);
  const next: Record<string, string> = {
    Idea: 'Outline',
    Scripted: 'Film',
    Filmed: 'Edit',
    Edited: 'Publish',
    Published: 'Attach the upload for',
  };
  const hidden = new Set(snoozes.results.map(({ action_id }) => action_id));
  const actions: PlanAction[] = [
    ...deals.results.map((deal): PlanAction => ({
      id: 'deal:' + deal.id + ':' + deal.stage,
      title: deal.stage === 'agreed' ? `Finish ${deal.brand}’s deliverable` : `Follow up on payment from ${deal.brand}`,
      reason:
        deal.stage === 'agreed'
          ? [deal.deliverable, deal.due_date && 'Due ' + deal.due_date].filter(Boolean).join(' · ')
          : 'The deliverable is marked posted and unpaid.',
      tab: 'deals',
    })),
    ...ready.results.map((project): PlanAction => ({
      id: 'review:' + project.id,
      title: `Review ${project.title}`,
      reason: 'A view count near day seven is available.',
      tab: 'studio',
      projectId: project.id,
    })),
    ...projects.results.map((project): PlanAction => ({
      id: 'project:' + project.id + ':' + project.status,
      title: `${next[project.status] || 'Continue'} ${project.title}`,
      reason:
        project.status === 'Published'
          ? 'Attach your upload to compare its performance.'
          : `Current stage is ${project.status.toLowerCase()}.`,
      tab: 'studio',
      projectId: project.id,
    })),
  ];
  if (!uploads?.latest || Date.now() - Date.parse(uploads.latest) > 14 * 86400000) {
    actions.push({
      id: 'library:recent',
      title: 'Check your recent uploads',
      reason: uploads?.latest
        ? 'Your latest recorded upload is more than two weeks old.'
        : 'Your Library has no published YouTube videos yet.',
      tab: 'library',
    });
  }
  return actions.filter(({ id }) => !hidden.has(id)).slice(0, 3);
}
