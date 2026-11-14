import React, { useEffect, useId, useState } from 'react';
import { Languages } from 'lucide-react';
import { api, type ScriptLanguage } from '../lib/api';
import { ICON } from './ui';

export const SCRIPT_LANGUAGE_OPTIONS: { value: ScriptLanguage; label: string; hint: string }[] = [
  { value: 'english', label: 'English', hint: 'Everything in English, even if you film in Hindi' },
  { value: 'hinglish', label: 'Hinglish', hint: 'Hindi and English mixed, written in Roman letters' },
  { value: 'hindi', label: 'Hindi', hint: 'Hindi in Devanagari script' },
  { value: 'match', label: 'Same as my videos', hint: 'Follows the language you create in' },
];

const EVENT = 'cb:script-language';
let cached: ScriptLanguage | null = null;

/**
 * "Write in" selector for drafting screens. Saves the creator's preference, so scripts,
 * titles and captions everywhere follow it; every picker on the page stays in sync.
 */
export const ScriptLanguagePicker: React.FC<{ compact?: boolean }> = ({ compact = true }) => {
  const id = useId();
  const [value, setValue] = useState<ScriptLanguage>(cached || 'english');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!cached) {
      api.auth
        .me()
        .then((res) => {
          cached = (res.creator?.script_language as ScriptLanguage) || 'english';
          setValue(cached);
        })
        .catch(() => {});
    }
    const sync = (e: Event) => setValue((e as CustomEvent<ScriptLanguage>).detail);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const change = async (next: ScriptLanguage) => {
    const prev = value;
    setValue(next);
    setStatus('');
    try {
      await api.settings.updatePreferences({ scriptLanguage: next });
      cached = next;
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
      setStatus('Saved');
      setTimeout(() => setStatus(''), 1500);
    } catch (err: unknown) {
      setValue(prev);
      setStatus(err instanceof Error ? err.message : 'Could not save');
    }
  };

  const hint = SCRIPT_LANGUAGE_OPTIONS.find((o) => o.value === value)?.hint;
  return (
    <div className={compact ? 'flex items-center gap-2' : ''}>
      <label htmlFor={id} className={compact ? 'flex items-center gap-1 text-[13px] text-fg-2 whitespace-nowrap' : 'field-label'}>
        {compact && <Languages {...ICON} className="text-fg-3" />}
        Write in
      </label>
      <select
        id={id}
        className={`input ${compact ? 'h-8 w-auto pr-8 text-[13px]' : ''}`}
        value={value}
        onChange={(e) => change(e.target.value as ScriptLanguage)}
        aria-describedby={`${id}-hint`}
      >
        {SCRIPT_LANGUAGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span id={`${id}-hint`} className={compact ? 'sr-only' : 'field-hint block'}>
        {hint}. Breakdowns and insights always stay in English
      </span>
      <span className="meta" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
};

/** Called after sign-out so the next account doesn't see a stale value */
export function resetScriptLanguageCache() {
  cached = null;
}
