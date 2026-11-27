import { z } from 'zod';
import {
  rolloutActions,
  STUDIO_EXPERIMENT_FLAG,
  type ExperimentReadout,
  type RolloutAction,
  type RolloutProposal,
} from '../../shared/studio-experiment';
import type { Env } from '../env';
import { AIRouter } from '../ai/router';
import { flagsmithEndpoint } from './studio-experiment';
import { reuseWorkspaceResult, workspaceDigest, WorkspaceResultBusy } from './workspace-results';

export const STUDIO_METRIC_NAME = 'Studio suggestion sent';

const status = z.enum(['created', 'running', 'paused', 'completed']);
const numId = z.number().int().positive();
const experimentSchema = z.object({
  id: numId,
  name: z.string(),
  hypothesis: z.string(),
  status,
  updated_at: z.string(),
  feature: z.object({
    id: numId,
    name: z.literal(STUDIO_EXPERIMENT_FLAG),
    multivariate_options: z.array(
      z.object({ id: numId, key: z.string().nullable(), string_value: z.string().nullable() })
    ),
  }),
  metrics: z.array(z.object({ id: numId, metric: numId, metric_name: z.string(), aggregation: z.string() })),
  experiment_rollout: z.unknown().optional(),
});
type Experiment = z.infer<typeof experimentSchema>;

const resultsSchema = z.object({
  results: z
    .object({
      as_of: z.string().nullable(),
      payload: z
        .object({
          srm_p_value: z.number().min(0).max(1).nullable().optional(),
          metrics: z.array(
            z.object({
              metric_id: numId,
              variants: z.record(
                z.string(),
                z.object({ n: z.number().int().nonnegative(), sum: z.number().nonnegative() })
              ),
              inference: z.record(z.string(), z.object({ chance_to_win: z.number().min(0).max(1) }).nullable()),
            })
          ),
        })
        .nullable(),
    })
    .nullable(),
});

export class FlagOperatorError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 | 503 = 503
  ) {
    super(message);
  }
}

function operatorConfig(env: Env, creatorId: string, isSample: boolean) {
  const id = Number(env.FLAGSMITH_EXPERIMENT_ID);
  return !isSample &&
    creatorId === env.FLAGSMITH_OPERATOR_CREATOR_ID &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    env.FLAGSMITH_SDK_KEY &&
    env.FLAGSMITH_MANAGEMENT_KEY
    ? { id, key: env.FLAGSMITH_MANAGEMENT_KEY, environment: env.FLAGSMITH_SDK_KEY }
    : null;
}

export function mayManageExperiment(env: Env, creatorId: string, isSample: boolean) {
  return Boolean(operatorConfig(env, creatorId, isSample));
}

function requireOperator(env: Env, creatorId: string, isSample: boolean) {
  const permissions = operatorConfig(env, creatorId, isSample);
  if (!permissions) throw new FlagOperatorError('Experiment console is unavailable.', 404);
  return permissions;
}

async function flagsmithManagement(
  env: Env,
  config: NonNullable<ReturnType<typeof operatorConfig>>,
  path = '',
  body?: Record<string, unknown>
) {
  const base = flagsmithEndpoint(
    env.FLAGSMITH_MANAGEMENT_API,
    'https://api.flagsmith.com/api/v1/',
    env.ENVIRONMENT === 'production'
  );
  const url = new URL(`environments/${encodeURIComponent(config.environment)}/experiments/${config.id}/${path}`, base);
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Api-Key ' + config.key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(4500),
  });
  if (response.status === 429)
    throw new FlagOperatorError('Flagsmith is rate limiting this request. Wait a few minutes and try again.', 409);
  if (!response.ok)
    throw new FlagOperatorError(
      `Flagsmith returned HTTP ${response.status}. Check the experiment and API permissions.`
    );
  return response.status === 204 || response.status === 202 ? null : response.json();
}

function brainOption(experiment: Experiment) {
  return experiment.feature.multivariate_options.find(
    (option) => option.key === 'brain' && option.string_value === 'brain'
  );
}

function actionsFor(experiment: Experiment): RolloutAction[] {
  if (experiment.status === 'created') return ['start'];
  if (experiment.status === 'completed') return [];
  return [
    experiment.status === 'running' ? 'pause' : 'start',
    'refresh',
    'rollout_control',
    ...(brainOption(experiment) ? ['rollout_brain' as const] : []),
  ];
}

async function getExperiment(env: Env, config: NonNullable<ReturnType<typeof operatorConfig>>) {
  const parsed = experimentSchema.safeParse(await flagsmithManagement(env, config));
  if (!parsed.success || parsed.data.id !== config.id)
    throw new FlagOperatorError('Configure the Flagsmith experiment for the studio_next_steps flag.');
  return parsed.data;
}

function experimentRevision(experiment: Experiment) {
  return workspaceDigest(experiment);
}

export async function experimentReadout(env: Env, creatorId: string, isSample: boolean) {
  const config = requireOperator(env, creatorId, isSample);
  const experiment = await getExperiment(env, config);
  const matchingMetric = experiment.metrics.find(
    (metric) => metric.metric_name === STUDIO_METRIC_NAME && metric.aggregation === 'occurrence'
  );
  const parsed =
    matchingMetric && experiment.status !== 'created'
      ? resultsSchema.safeParse(await flagsmithManagement(env, config, 'results/').catch(() => null))
      : null;
  const result = parsed?.success ? parsed.data.results : null;
  const metric =
    result?.payload?.metrics.find(({ metric_id }) => metric_id === matchingMetric?.id) ??
    result?.payload?.metrics.find(({ metric_id }) => metric_id === matchingMetric?.metric);
  const inference = metric?.inference.brain?.chance_to_win ?? null;
  const variants = (['control', 'brain'] as const).map((key) => ({
    key,
    exposures: metric?.variants[key]?.n ?? 0,
    converters: metric?.variants[key]?.sum ?? 0,
    probability: inference === null ? null : key === 'brain' ? inference : 1 - inference,
  }));
  const winner =
    variants.some((variant) => variant.exposures < 100) || (result?.payload?.srm_p_value ?? 1) < 0.01
      ? null
      : (variants.find((variant) => (variant.probability ?? 0) >= 0.95)?.key ?? null);
  const projectId = env.FLAGSMITH_PROJECT_ID;
  const url =
    projectId && /^\d+$/.test(projectId) && !env.FLAGSMITH_MANAGEMENT_API
      ? `https://app.flagsmith.com/project/${projectId}/environment/${encodeURIComponent(config.environment)}/experiments/${config.id}`
      : null;
  const summary: ExperimentReadout = {
    name: experiment.name,
    status: experiment.status,
    hypothesis: experiment.hypothesis,
    asOf: metric ? (result?.as_of ?? null) : null,
    variants,
    flagsmithUrl: url,
    actions: actionsFor(experiment),
  };
  return { summary, experiment, config, winner };
}

const agentResult = z.object({
  action: z.enum([...rolloutActions, 'explain', 'winner']),
  reasoning: z.string().trim().max(400),
});
type PlanIntent = z.infer<typeof agentResult>;

export function explicitRolloutIntent(prompt: string): PlanIntent['action'] | null {
  const message = prompt
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+$/, '');
  if (/\b(?:do not|don't|never|without)\b/.test(message)) return 'explain';
  if (/^(?:(?:please )?(?:show|explain|review)\b|what|why|how|is |can )/.test(message)) return 'explain';
  if (/^(?:please )?(?:pause|stop collecting)(?: the experiment| the test| now)?$/.test(message)) return 'pause';
  if (/^(?:please )?(?:start|resume|restart)(?: the experiment| the test| now)?$/.test(message)) return 'start';
  if (/^(?:please )?(?:refresh|recompute)(?: the results| the metrics)?$/.test(message)) return 'refresh';
  if (/^(?:please )?(?:roll out|ship) (?:the )?(?:winner|winning variant)$/.test(message)) return 'winner';
  if (/^(?:please )?(?:roll out|ship) (?:the )?(?:control|general suggestions)$/.test(message))
    return 'rollout_control';
  if (/^(?:please )?(?:roll out|ship) (?:the )?(?:brain|personalized suggestions)$/.test(message))
    return 'rollout_brain';
  return null;
}

export async function proposeExperimentChange(env: Env, creatorId: string, isSample: boolean, prompt: string) {
  const { summary, experiment, config, winner } = await experimentReadout(env, creatorId, isSample);
  const explicit = explicitRolloutIntent(prompt);
  let intent: PlanIntent = { action: explicit ?? 'explain', reasoning: '' };
  if (!explicit) {
    try {
      const inputs = { prompt, summary };
      intent = (
        await reuseWorkspaceResult(env.DB, creatorId, 'flagsmith-intent-v1', inputs, agentResult, () => {
          return new AIRouter(env).generateStructured(
            [
              {
                role: 'system',
                content:
                  'Classify the operator’s request for the Studio feature flag. Choose explain for questions, uncertainty or negation, winner for an explicit request to roll out the winner, or one of the allowed specific actions when explicitly requested. Return JSON with action and reasoning. Refer only to supplied facts. Never request or perform any change yourself.',
              },
              { role: 'user', content: JSON.stringify(inputs) },
            ],
            agentResult,
            { creatorId, requireLive: true, fast: true, maxTokens: 220 }
          );
        })
      ).value;
    } catch (error) {
      if (error instanceof WorkspaceResultBusy) throw error;
      return { summary, message: 'Try “Pause the experiment”, “Refresh the results”, or “Roll out the winner”.' };
    }
  }
  const noWinner =
    'There is no recommended winner. This console looks for at least 100 exposures per group, a 95% win probability, and no detected sample-ratio mismatch.';
  if (intent.action === 'explain' || (intent.action === 'winner' && !winner)) {
    return {
      summary,
      message: winner
        ? (winner === 'brain' ? 'Brain suggestions' : 'General suggestions') + ' meets the recommendation threshold.'
        : noWinner,
    };
  }
  const action =
    intent.action === 'winner' ? (winner === 'brain' ? 'rollout_brain' : 'rollout_control') : intent.action;
  if (!summary.actions.includes(action))
    return { summary, message: 'That action isn’t available while the experiment is ' + experiment.status + '.' };
  const descriptions: Record<RolloutAction, string> = {
    start:
      experiment.status === 'paused'
        ? 'Resume enrollment in this Flagsmith experiment.'
        : 'Start enrollment in this Flagsmith experiment.',
    pause: 'Pause enrollment in this Flagsmith experiment.',
    refresh: 'Ask Flagsmith to recompute the experiment results.',
    rollout_control: 'End the experiment and serve general suggestions by default in this environment.',
    rollout_brain: 'End the experiment and serve Brain-grounded suggestions by default in this environment.',
  };
  const expires = Date.now() + 10 * 60_000;
  const proposal: RolloutProposal = {
    action,
    description: descriptions[action],
    reasoning:
      intent.reasoning ||
      (intent.action === 'winner' ? 'The Flagsmith results meet the recommendation threshold.' : ''),
    approvalId: crypto.randomUUID(),
    expiresAt: new Date(expires).toISOString(),
  };
  await env.DB.prepare(
    'INSERT INTO flagsmith_approvals(id,creator_id,environment,experiment_id,action,revision,expected_winner,expires_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  )
    .bind(
      proposal.approvalId,
      creatorId,
      await workspaceDigest(config.environment),
      config.id,
      action,
      await experimentRevision(experiment),
      intent.action === 'winner' ? winner : null,
      expires,
      new Date().toISOString()
    )
    .run();
  return { summary, proposal };
}

export async function applyExperimentApproval(env: Env, creatorId: string, isSample: boolean, approvalId: string) {
  const config = requireOperator(env, creatorId, isSample);
  const environment = await workspaceDigest(config.environment);
  const now = Date.now();
  const approval = await env.DB.prepare(
    "SELECT revision,action,expected_winner FROM flagsmith_approvals WHERE id=? AND creator_id=? AND environment=? AND experiment_id=? AND status='pending' AND expires_at>?"
  )
    .bind(approvalId, creatorId, environment, config.id, now)
    .first<{ revision: string; action: string; expected_winner: string | null }>();
  if (!approval)
    throw new FlagOperatorError('This approval has expired or already been used. Prepare a fresh change.', 409);
  const action = z.enum(rolloutActions).parse(approval.action);
  await env.DB.prepare(
    "UPDATE flagsmith_approvals SET status='failed',updated_at=? WHERE environment=? AND experiment_id=? AND status='applying' AND updated_at<?"
  )
    .bind(new Date(now).toISOString(), environment, config.id, new Date(now - 120000).toISOString())
    .run();
  const claim = await env.DB.prepare(
    `UPDATE flagsmith_approvals SET status='applying',updated_at=?
     WHERE id=? AND creator_id=? AND status='pending' AND expires_at>? AND NOT EXISTS
       (SELECT 1 FROM flagsmith_approvals WHERE environment=? AND experiment_id=? AND status='applying')`
  )
    .bind(new Date(now).toISOString(), approvalId, creatorId, now, environment, config.id)
    .run();
  if (!claim.meta.changes)
    throw new FlagOperatorError('A change is already being applied. Refresh the experiment before trying again.', 409);
  const save = (outcome: 'applied' | 'failed') =>
    env.DB.prepare(
      "UPDATE flagsmith_approvals SET status=?,updated_at=? WHERE id=? AND creator_id=? AND status='applying'"
    )
      .bind(outcome, new Date().toISOString(), approvalId, creatorId)
      .run();
  try {
    const data = approval.expected_winner ? await experimentReadout(env, creatorId, isSample) : null;
    if (data && data.winner !== approval.expected_winner)
      throw new FlagOperatorError('The results no longer support that winner. Prepare a fresh change.', 409);
    const experiment = data?.experiment ?? (await getExperiment(env, config));
    if ((await experimentRevision(experiment)) !== approval.revision || !actionsFor(experiment).includes(action))
      throw new FlagOperatorError('The experiment changed after this preview. Prepare a fresh change.', 409);
    const path =
      action === 'refresh' ? 'results/refresh/' : action === 'start' || action === 'pause' ? action + '/' : 'complete/';
    const body =
      action === 'rollout_brain'
        ? { rollout_decision: 'variant', rollout_variant: brainOption(experiment)!.id }
        : action === 'rollout_control'
          ? { rollout_decision: 'control' }
          : {};
    await flagsmithManagement(env, config, path, body);
  } catch (error) {
    await save('failed');
    throw error;
  }
  await save('applied');
  return { success: true as const };
}
