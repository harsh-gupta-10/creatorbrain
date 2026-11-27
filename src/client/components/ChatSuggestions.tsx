import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { ChatSuggestion } from '../../shared/chat-suggestions';
import { api } from '../lib/api';
import { useStudyRefresh } from './StudyBanner';
import { ICON } from './ui';

/** Undefined selects Copilot. A null project keeps an empty Studio idle. */
export function useChatSuggestions(projectId: string | null | undefined, working: boolean) {
  const [state, setState] = useState<{ projectId: typeof projectId; suggestions: ChatSuggestion[] }>();
  const [revision, setRevision] = useState(0);
  useStudyRefresh(() => setRevision((previous) => previous + 1));
  useEffect(() => {
    if (projectId === null || working) return;
    const controller = new AbortController();
    api.brain
      .getSuggestions(projectId, controller.signal)
      .then(({ suggestions }) => {
        if (!controller.signal.aborted) setState({ projectId, suggestions });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [projectId, working, revision]);

  return state?.projectId === projectId ? state?.suggestions || [] : [];
}

export function ChatSuggestions({
  suggestions,
  onChoose,
  disabled,
}: {
  suggestions: ChatSuggestion[];
  onChoose: (prompt: string) => void;
  disabled: boolean;
}) {
  if (!suggestions.length) return null;
  return (
    <section aria-label="Suggested next steps">
      <h3 className="text-[12px] font-medium text-fg-2 mb-1.5">Suggested next steps</h3>
      <ul className="grid gap-1.5 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
        {suggestions.map((item) => (
          <li key={item.id} className="min-w-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(item.prompt)}
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
