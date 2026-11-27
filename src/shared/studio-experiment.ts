export const STUDIO_EXPERIMENT_FLAG = 'studio_next_steps';
export const STUDIO_SUGGESTION_EVENT = 'studio_suggestion_sent';
export const STUDIO_HYPOTHESIS =
  'Suggestions grounded in the creator’s Brain increase the share of exposed creators who send a suggested prompt.';
export type StudioVariant = 'control' | 'brain';
export type StudioExperimentEvent = 'seen' | 'sent';

export const rolloutActions = ['start', 'pause', 'refresh', 'rollout_control', 'rollout_brain'] as const;
export type RolloutAction = (typeof rolloutActions)[number];

export interface ExperimentReadout {
  name: string;
  status: 'created' | 'running' | 'paused' | 'completed';
  hypothesis: string;
  asOf: string | null;
  variants: { key: StudioVariant; exposures: number; converters: number; probability: number | null }[];
  flagsmithUrl: string | null;
  actions: RolloutAction[];
}

export interface RolloutProposal {
  action: RolloutAction;
  description: string;
  reasoning: string;
  approvalId: string;
  expiresAt: string;
}
