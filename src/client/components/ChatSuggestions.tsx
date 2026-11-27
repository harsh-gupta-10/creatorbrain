import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { ChatSuggestion } from '../../shared/chat-suggestions';
import { api, ApiError } from '../lib/api';
import { useStudyRefresh } from './StudyBanner';
import type { StudioExperimentEvent } from '../../shared/studio-experiment';
import { ICON } from './ui';

/** Undefined selects Copilot. A null project keeps an empty Studio idle. */
export function useChatSuggestions(
  projectId: string | null | undefined,
  working: boolean
): { suggestions: ChatSuggestion[]; experimentTicket?: string } {
  const [state, setState] = useState<{
    projectId: typeof projectId;
    suggestions: ChatSuggestion[];
    experimentTicket?: string;
  }>();
  const [revision, setRevision] = useState(0);
  useStudyRefresh(() => setRevision((previous) => previous + 1));
  useEffect(() => {
    if (projectId === null || working) return;
    const controller = new AbortController();
    api.brain
      .getSuggestions(projectId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ projectId, ...data });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [projectId, working, revision]);

  return state?.projectId === projectId && state ? state : { suggestions: [] };
}

export async function reportStudioExperiment(ticket: string, event: StudioExperimentEvent) {
  for (const delay of [0, 800, 2200]) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      await api.experiments.event(ticket, event);
      return;
    } catch (error) {
      if (error instanceof ApiError && ![409, 503].includes(error.status)) return;
    }
  }
}

export function ChatSuggestions({
  suggestions,
  onChoose,
  disabled,
  experimentTicket,
}: {
  suggestions: ChatSuggestion[];
  onChoose: (prompt: string, experimentTicket?: string) => void;
  experimentTicket?: string;
  disabled: boolean;
}) {
  const section = useRef<HTMLElement>(null);
  const hasSuggestions = suggestions.length > 0;
  useEffect(() => {
    if (!experimentTicket || disabled || !hasSuggestions || !section.current) return;
    let recorded = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5 && document.visibilityState === 'visible') {
          recorded = true;
          observer.disconnect();
          void reportStudioExperiment(experimentTicket, 'seen');
        }
      },
      { threshold: 0.5 }
    );
    const element = section.current;
    const onVisibility = () => {
      if (recorded || document.visibilityState !== 'visible') return;
      observer.unobserve(element);
      observer.observe(element);
    };
    observer.observe(element);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [experimentTicket, disabled, hasSuggestions]);
  if (!hasSuggestions) return null;
  return (
    <section ref={section} aria-label="Suggested next steps">
      <h3 className="text-[12px] font-medium text-fg-2 mb-1.5">Suggested next steps</h3>
      <ul className="grid gap-1.5 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
        {suggestions.map((item) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(item.prompt, experimentTicket)}
              className="group h-full w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left hover:border-accent hover:bg-accent-soft disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-1 text-[12px] leading-4 font-medium text-fg">
                {item.label}
                <ArrowUpRight {...ICON} size={13} className="shrink-0 text-fg-3 group-hover:text-accent-ink" />
              </span>
              <span className="block truncate text-[11px] leading-4 text-fg-3" title={item.reason}>
                {item.reason}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
