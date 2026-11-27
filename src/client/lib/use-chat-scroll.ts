import { useEffect, useRef } from 'react';

/** Keep new messages in view without scrolling any ancestor or interrupting older reading. */
export function useChatScroll(messages: readonly unknown[], pending: boolean) {
  const logRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    const log = logRef.current;
    if (log && follow.current) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  return {
    logRef,
    followLatest: () => {
      follow.current = true;
    },
    updateFollow: () => {
      const log = logRef.current;
      if (log) follow.current = log.scrollHeight - log.scrollTop - log.clientHeight < 64;
    },
  };
}
