export const agentKinds = {
  competitor: 'Competitor study',
  titles: 'Title coach',
  short_script: 'Short script writer',
  full_script: 'Full script writer',
} as const;

export interface AgentConfig {
  name: string;
  kind: keyof typeof agentKinds;
  focus: string;
  channel: string;
}
export interface SavedAgent extends AgentConfig {
  id: string;
  report: string | null;
  last_run: string | null;
}
