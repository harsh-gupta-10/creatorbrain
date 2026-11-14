import { describe, it, expect } from 'vitest';
import { draftLanguageRule, chatLanguageRule, scriptLanguageOf, ANALYSIS_LANGUAGE_RULE } from '../src/worker/lib/language';

describe('Script language rules', () => {
  it('defaults to English for unknown or missing values', () => {
    expect(scriptLanguageOf({})).toBe('english');
    expect(scriptLanguageOf({ script_language: 'klingon' })).toBe('english');
  });

  it('keeps drafts in English even when the creator films in Hindi', () => {
    const rule = draftLanguageRule({ script_language: 'english', content_language: 'Hindi' });
    expect(rule).toMatch(/in English, even if the creator films in Hindi/);
  });

  it('asks for Hinglish in Roman letters, never Devanagari', () => {
    const rule = draftLanguageRule({ script_language: 'hinglish' });
    expect(rule).toMatch(/Roman \(Latin\) letters/);
    expect(rule).toMatch(/Never use Devanagari/);
  });

  it('uses Devanagari only when Hindi is chosen', () => {
    expect(draftLanguageRule({ script_language: 'hindi' })).toMatch(/Devanagari script/);
  });

  it('follows the video language when set to match', () => {
    expect(draftLanguageRule({ script_language: 'match', content_language: 'Hindi and English' })).toMatch(/Hindi and English/);
  });

  it('keeps chat explanations and analysis in English', () => {
    expect(chatLanguageRule({ script_language: 'hindi' })).toMatch(/^Explain and advise in English/);
    expect(ANALYSIS_LANGUAGE_RULE).toMatch(/Write every field in English/);
  });
});
