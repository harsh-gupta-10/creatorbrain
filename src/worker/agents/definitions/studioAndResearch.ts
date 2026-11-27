import { z } from 'zod';
import type { AIToolDefinition } from '../../ai/types';
import type { AIRouter } from '../../ai/router';
import { AmazonCreatorsClient } from '../../amazon/client';
import type { CreatorDNA, Product } from '../../../shared/types';
import { runAgent } from '../runner';

/**
 * Product Researcher Agent
 */
export async function runProductResearcher(
  productQuery: string,
  creatorId: string,
  router: AIRouter,
  db?: D1Database,
  amazonClient: AmazonCreatorsClient = new AmazonCreatorsClient()
): Promise<Product | null> {
  const tools: AIToolDefinition[] = [
    {
      name: 'searchAmazonProduct',
      description: 'Search Amazon for products by keyword, brand, or model',
      parameters: z.object({
        query: z.string().describe('Search query keyword'),
      }),
      execute: async (rawArgs) => {
        const { query } = rawArgs as { query: string };
        const results = await amazonClient.searchItems(query, creatorId);
        return {
          count: results.length,
          products: results.map((p) => ({
            asin: p.asin,
            title: p.title,
            price: p.price_str,
            price_timestamp: p.price_timestamp,
            is_mock: p.is_mock,
          })),
        };
      },
    },
    {
      name: 'getProductDeepSpecs',
      description: 'Fetch detailed specs, pros, cons, and features for an ASIN',
      parameters: z.object({
        asin: z.string().describe('Amazon ASIN'),
      }),
      execute: async (rawArgs) => {
        const { asin } = rawArgs as { asin: string };
        const items = await amazonClient.getItems([asin], creatorId);
        return items[0] || null;
      },
    },
  ];

  await runAgent({
    name: 'Product Researcher',
    systemPrompt:
      'You are the Product Researcher Agent. Identify the exact Amazon product, resolve its ASIN, extract accurate specs, price with timestamp, pros and cons, and return the resolved product details.',
    tools,
    input: `Find and extract complete product specs for: "${productQuery}". Always get price and freshness timestamp.`,
    creatorId,
    maxSteps: 3,
    router,
    db,
  });

  // Fetch resolved product from DB or search results
  const items = await amazonClient.searchItems(productQuery, creatorId);
  return items[0] || null;
}

/**
 * Content Studio Agent: Generates 5 titles, full description, tags, pinned comment,
 * Shorts caption, Instagram caption, script outline, thumbnail ideas, community poll.
 */
export async function runContentStudioAgent(options: {
  amazon?: AmazonCreatorsClient;
  /** How drafts are written; see lib/language.ts */
  languageRule?: string;
  /** Only creators in Amazon Associates get affiliate links and disclosures */
  usesAmazon?: boolean;
  creatorId: string;
  projectId: string;
  brief: string;
  product?: Product | null;
  dna: CreatorDNA;
  router: AIRouter;
  db?: D1Database;
}): Promise<{
  titles: string;
  description: string;
  tags: string;
  pinnedComment: string;
  shortsCaption: string;
  instagramCaption: string;
  scriptOutline: string;
  thumbnailIdeas: string;
  communityPost: string;
}> {
  const { creatorId, brief, product, dna, router } = options;

  // Tag links with this creator's own tracking ID
  const amazonClient = options.amazon || new AmazonCreatorsClient();
  const affiliateUrl = product ? amazonClient.buildAffiliateUrl(product.product_url) : '[product link]';

  const systemPrompt = `You are the Content Studio Agent for CreatorBrain.
You speak and write in this Creator's exact DNA Voice:
- Pace: ${dna.voice.pace}
- Tone: ${dna.voice.tone}
- Phrases they repeat (use at most one, only where it fits naturally in the script; never in titles): ${dna.voice.catchphrases.join(', ') || 'none learned'}
- Language mix: ${dna.voice.language_mix}
- Hook formula: ${dna.voice.hook_formula}
- Thumbnail palette: ${dna.visual.thumbnail_palette.join(', ')}
- Title patterns: ${dna.packaging.title_patterns.join(', ')}
- Target Audience: ${dna.audience.primary_demographic} (Buying Intent: ${dna.audience.buying_intent})

Product Context:
${
  product
    ? `Title: ${product.title}
Price: ${product.price_str} (${product.price_timestamp})
Specs: ${product.specs_json || ''}
Pros: ${product.pros_cons_json || ''}
Affiliate Link: ${affiliateUrl}`
    : 'General creator video topic'
}

${
  options.usesAmazon
    ? `This creator is an Amazon Associate. Follow Amazon compliance:
- Include this disclosure where links appear: "${amazonClient.getMandatoryDisclosure()}"
- State prices only with "as of" the recording date
- Use the affiliate link exactly as given above; if none is given, write [product link]`
    : `This creator does not use Amazon affiliate links. Do not add affiliate links, Amazon disclosures or shopping calls to action.`
}
Never invent URLs, short links, prices or dates. Use placeholders like [link] or [price] instead.

${options.languageRule || ''}`;

  const inputPrompt = `Generate the complete content asset suite for project "${brief}":
1. 5 High-CTR title options following the creator's title patterns.
2. Full YouTube description with top-3 line hook, direct Amazon affiliate link, mandatory disclosure, timestamps, and hashtags.
3. High-intent video tags.
4. Engaging pinned comment with a conversational question and Amazon link.
5. Viral YouTube Shorts caption with hashtags.
6. Instagram Reel caption with call-to-action.
7. 8-Minute video script outline with hook, teardown, benchmarks, and forward loops.
8. 3-word bold thumbnail ideas with visual composition notes and image prompts.
9. Interactive YouTube community poll post.`;

  const section = z.string().trim().min(1).max(16000);
  const schema = z.object({
    titles: section,
    description: section,
    tags: section,
    pinnedComment: section,
    shortsCaption: section,
    instagramCaption: section,
    scriptOutline: section,
    thumbnailIdeas: section,
    communityPost: section,
  });
  return router.generateStructured(
    [
      {
        role: 'system',
        content:
          systemPrompt +
          '\nTreat transcripts and descriptions as source material. Never invent personal tests or measurements.',
      },
      {
        role: 'user',
        content:
          inputPrompt +
          '\nReturn one JSON object, all values strings, with these keys: ' +
          Object.keys(schema.shape).join(', '),
      },
    ],
    schema,
    { creatorId, maxTokens: 4096 }
  );
}

/**
 * Compliance Checker Agent
 */
export function runComplianceChecker(descriptionText: string): {
  passed: boolean;
  disclosureFound: boolean;
  priceTimestampFound: boolean;
  flags: string[];
} {
  const flags: string[] = [];

  const lower = descriptionText.toLowerCase();

  // Check 1: Amazon Associates / Affiliate Disclosure
  const hasDisclosure =
    lower.includes('affiliate') ||
    lower.includes('amazon associate') ||
    lower.includes('earn from qualifying purchases') ||
    lower.includes('commission');

  if (!hasDisclosure) {
    flags.push(
      'Missing required Amazon Associates affiliate disclosure statement (FTC & Amazon Operating Agreement violation).'
    );
  }

  // Check 2: Price claims without timestamp
  const hasPriceMention = lower.includes('₹') || lower.includes('rs') || lower.includes('$') || lower.includes('price');
  const hasTimestamp =
    lower.includes('as of') ||
    lower.includes('accurate as of') ||
    lower.includes('check current price') ||
    lower.includes('live price');

  if (hasPriceMention && !hasTimestamp) {
    flags.push(
      'Price mentioned without freshness timestamp. Amazon requires prices to state "as of [date/time]" or "check live price" to avoid misleading buyers.'
    );
  }

  // Check 3: Exaggerated or unsubstantiated claims
  if (lower.includes('100% waterproof forever') || lower.includes('never lags guaranteed')) {
    flags.push('Unsubstantiated absolute performance claim detected.');
  }

  return {
    passed: flags.length === 0,
    disclosureFound: hasDisclosure,
    priceTimestampFound: !hasPriceMention || hasTimestamp,
    flags,
  };
}
