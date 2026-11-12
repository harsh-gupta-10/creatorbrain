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
  db?: D1Database
): Promise<Product | null> {
  const amazonClient = new AmazonCreatorsClient();

  const tools: AIToolDefinition[] = [
    {
      name: 'searchAmazonProduct',
      description: 'Search Amazon for products by keyword, brand, or model',
      parameters: z.object({
        query: z.string().describe('Search query keyword'),
      }),
      execute: async ({ query }) => {
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
      execute: async ({ asin }) => {
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

  const amazonClient = new AmazonCreatorsClient();
  const affiliateUrl = product
    ? amazonClient.buildAffiliateUrl(product.product_url)
    : 'https://creatorbrain.dev/s/deal';

  const systemPrompt = `You are the Content Studio Agent for CreatorBrain.
You speak and write in this Creator's exact DNA Voice:
- Pace: ${dna.voice.pace}
- Tone: ${dna.voice.tone}
- Catchphrases to use naturally: ${dna.voice.catchphrases.join(', ')}
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

Always follow Amazon compliance:
- Must include conspicuous disclosure: "${amazonClient.getMandatoryDisclosure()}"
- Must state price snapshot with timestamp ("as of recorded date")
- Never use deceptive cloaking or unverifiable claims.`;

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

  const responseText = await router.generateText(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputPrompt },
    ],
    { creatorId, maxTokens: 4096 }
  );

  const titles =
    extractSection(responseText, 'titles', 'title options') ||
    `1. ${product?.title ? product.title.slice(0, 30) : 'New Tech'}: Don't Buy Until You See This!
2. I Tested It For 7 Days... Huge Mistake? (Honest Review)
3. The Brutal Truth About ${product?.title ? product.title.slice(0, 25) : 'This Device'} Nobody Tells You
4. Real Teardown & Benchmark Truth! Worth Your Hard-Earned Rupees?
5. Best In Its Segment? There Is Only ONE Winner.`;

  const description =
    extractSection(responseText, 'description', 'youtube description') ||
    `${brief}

Check Live Amazon Deals & Discounts:
👉 Buy on Amazon: ${affiliateUrl}
👉 My Recommended Creator Gear: https://creatorbrain.dev/@techkabir

Affiliate Disclosure: As an Amazon Associate, I earn from qualifying purchases made through links above at no extra cost to you. Pricing and availability accurate as of video upload (${product?.price_timestamp || 'recent'}).

In this video, we pop the hood and examine real performance, build quality, and value-for-money.

⏱️ Timestamps:
0:00 - The Real Dilemma
0:45 - Hardware Teardown & Build Quality
2:15 - Display & Audio Performance
4:00 - Camera Benchmark Samples
5:30 - Throttling & Battery Stress Test
7:15 - The Final Verdict

#TechReview #AmazonDeals #CreatorBrain`;

  const tags =
    extractSection(responseText, 'tags', 'video tags') ||
    `${product?.title?.toLowerCase().slice(0, 30) || 'gadget review'}, honest review, benchmark test, unboxing, teardown, best budget tech, amazon deals, paisa vasool`;

  const pinnedComment =
    extractSection(responseText, 'pinned comment', 'pinned') ||
    `🔥 Real talk: What do you think of this product? Is it worth the price tag or would you pick the competitor? Drop your thoughts below!
🛒 Check current Amazon bank offers here: ${affiliateUrl}
(Affiliate link - supports independent hardware reviews!)`;

  const shortsCaption =
    extractSection(responseText, 'shorts caption', 'shorts') ||
    `Is this really worth your money? 📱 We popped the hood and tested thermals under extreme load! Watch the full video on channel! Link in bio. #TechShorts #GadgetTeardown #CreatorMode`;

  const instagramCaption =
    extractSection(responseText, 'instagram caption', 'instagram') ||
    `Tested under extreme conditions so you don't waste your hard-earned cash! 💥 Swipe for real thermal camera benchmarks and camera samples. Tap link in bio for full review & Amazon deals! #techreview #hardware #honesttech`;

  const scriptOutline =
    extractSection(responseText, 'script outline', 'script') ||
    `### 0:00 - 0:40: The Teardown Hook
- Macro shot of product. Kabir: "Most reviewers claim this is flawless. They're wrong. Let's pop the hood."
- Forward loop: "Stay until minute 5 for the thermal stress test that shocked me."

### 0:40 - 2:30: Build & Hardware Internals
- Physical teardown, ports, display panel, tactile feedback.

### 2:30 - 4:30: Real-World Camera & Audio Benchmarks
- Side-by-side photo crops, microphone noise suppression test.

### 4:30 - 6:30: Thermals, Gaming & Battery Drain
- 20-minute continuous load test. Thermal camera reading.

### 6:30 - 8:00: Final Verdict & Persona Recommendations
- Who should buy this, who should skip it. Call-to-action for Amazon links.`;

  const thumbnailIdeas =
    extractSection(responseText, 'thumbnail ideas', 'thumbnail') ||
    `Concept 1:
- Left: Product with dramatic cyan/amber rim light.
- Right: Kabir with shock reaction pointing to screen.
- Text: "DON'T BUY THIS!" (Bold electric yellow)

Concept 2:
- Split screen: Thermal heat camera overlay on product.
- Text: "MISTAKE AT ₹22K?" (Bold white with red shadow)`;

  const communityPost =
    extractSection(responseText, 'community post', 'community poll') ||
    `Which feature matters most to you in this category?
1. Clean software & zero bloatware
2. Massive battery & fast charging in box
3. Camera quality in night mode
4. Best gaming frame rates

Drop your comments below! Full video goes live tonight!`;

  return {
    titles,
    description,
    tags,
    pinnedComment,
    shortsCaption,
    instagramCaption,
    scriptOutline,
    thumbnailIdeas,
    communityPost,
  };
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
  const hasPriceMention =
    lower.includes('₹') || lower.includes('rs') || lower.includes('$') || lower.includes('price');
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

function extractSection(fullText: string, primaryTag: string, secondaryTag: string): string | null {
  const lines = fullText.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    const l = line.toLowerCase();
    if (
      (l.includes(primaryTag) || l.includes(secondaryTag)) &&
      (line.startsWith('#') || line.startsWith('**') || line.startsWith('1.') || line.includes(':'))
    ) {
      if (inSection && sectionLines.length > 0) break;
      inSection = true;
      continue;
    }

    if (inSection) {
      if (line.startsWith('## ') || line.startsWith('### ') || (line.startsWith('**') && line.endsWith('**') && line.length < 35)) {
        break;
      }
      sectionLines.push(line);
    }
  }

  if (sectionLines.length > 0) {
    return sectionLines.join('\n').trim();
  }
  return null;
}
