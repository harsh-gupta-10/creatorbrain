import { useEffect, useState } from 'react';

// Minimal path router: pushState + a custom event so every hook re-renders.
const EVENT = 'cb:navigate';

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return;
  if (opts.replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo(0, 0);
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return path;
}

/** Anchor that routes client-side on plain left clicks */
export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
