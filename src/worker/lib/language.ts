// Language rules for generated text.
//
// A creator can film in Hindi but want to read everything in English, or want their
// scripts in Hinglish written in Roman letters. Two separate settings come into play:
//  - content_language: what their videos are in (used to pick caption tracks)
//  - script_language:  how drafts (scripts, titles, captions, hooks) are written
// Analysis and insights are always written in English so the interface stays readable.

export const SCRIPT_LANGUAGES = ['english', 'hinglish', 'hindi', 'match'] as const;
export type ScriptLanguage = (typeof SCRIPT_LANGUAGES)[number];

export const SCRIPT_LANGUAGE_LABELS: Record<ScriptLanguage, string> = {
  english: 'English',
  hinglish: 'Hinglish (Roman letters)',
  hindi: 'Hindi (Devanagari)',
  match: 'Same as my videos',
};

interface LanguageSource {
  script_language?: string | null;
  content_language?: string | null;
}

export function scriptLanguageOf(creator: LanguageSource): ScriptLanguage {
  return (SCRIPT_LANGUAGES as readonly string[]).includes(creator.script_language || '')
    ? (creator.script_language as ScriptLanguage)
    : 'english';
}

/** One instruction line for any prompt that drafts content for the creator to say or post */
export function draftLanguageRule(creator: LanguageSource): string {
  switch (scriptLanguageOf(creator)) {
    case 'hinglish':
      return 'LANGUAGE: Write every script, title, hook, caption and description in Hinglish: natural Hindi-English mix the way Indian creators speak, always in Roman (Latin) letters. Never use Devanagari script.';
    case 'hindi':
      return 'LANGUAGE: Write every script, title, hook, caption and description in Hindi using Devanagari script. Keep brand and product names as they are.';
    case 'match':
      return `LANGUAGE: Write drafts in the same language as the creator's videos (${creator.content_language || 'English'}). If that is Hindi or a Hindi-English mix, write it in Roman (Latin) letters, not Devanagari.`;
    default:
      return 'LANGUAGE: Write every script, title, hook, caption and description in English, even if the creator films in Hindi or another language. Keep catchphrases they repeat in Roman letters.';
  }
}

/** For chat surfaces: explanations in English, drafted lines follow the creator's choice */
export function chatLanguageRule(creator: LanguageSource): string {
  return `Explain and advise in English. ${draftLanguageRule(creator).replace('LANGUAGE: ', 'For any lines the creator will say or post: ')}`;
}

/** Breakdowns, strengths, gaps and other insights are always readable English */
export const ANALYSIS_LANGUAGE_RULE =
  'Write every field in English. When quoting speech that is in Hindi or another language, write the quote in Roman (Latin) letters and add a short English translation in brackets.';
