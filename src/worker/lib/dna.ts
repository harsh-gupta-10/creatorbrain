import { CreatorDNASchema, type Creator, type CreatorDNA } from '../../shared/types';

/**
 * The creator's learned DNA, or a neutral starting point built from their own
 * onboarding answers when no study has finished yet. Never another creator's voice.
 */
export function creatorDna(creator: Pick<Creator, 'dna_summary' | 'niche' | 'content_language'>): CreatorDNA {
  if (creator.dna_summary) {
    try {
      return CreatorDNASchema.parse(JSON.parse(creator.dna_summary));
    } catch {
      // fall through to the neutral profile
    }
  }
  const niche = creator.niche || 'their niche';
  return {
    voice: {
      pace: 'Conversational',
      tone: 'Clear and direct',
      catchphrases: [],
      language_mix: creator.content_language || 'English',
      hook_formula: 'Open on the result or question the title promises',
    },
    visual: { thumbnail_palette: [], composition: 'Single clear subject, short text overlay', text_overlay_words: 3 },
    packaging: {
      title_avg_length: 50,
      title_patterns: [],
      disclosure_position: 'First three lines of the description',
    },
    audience: {
      primary_demographic: `Viewers interested in ${niche}`,
      buying_intent: 'Unknown until links are tracked',
    },
  };
}
