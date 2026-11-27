import { amazonProductUrl, tagAmazonProduct } from '../../shared/amazon';
import { ToolGeneratorSchema, type Creator, type ShortLink } from '../../shared/types';
import { amazonClientFor } from '../amazon/credentials';
import type { Env } from '../env';
import type { ChatMessage } from '../lib/chats';
import { isAmazonDestination, saveShortLink, ShortLinkError } from '../lib/short-links';
import { isSafePublicHttpUrl } from '../lib/url-safety';
import { runQuickTool, type QuickToolInput } from './quick-tools';

type ToolResult = {
  reply: string;
  shortLink?: string;
  meta?: Record<string, unknown>;
};

const quickNames: Record<string, QuickToolInput['toolType']> = {
  hook: 'hook',
  hooks: 'hook',
  script: 'script',
  thumbnail: 'thumbnail',
  caption: 'caption_hashtag',
  captions: 'caption_hashtag',
};

export const CHAT_TOOLS_HELP = [
  'Short links: ask “Make this a short link” or type /shorten followed by a URL.',
  'Click counts: type /link-stats with a short link or its slug, or ask for clicks on the last short link.',
  'Quick Tools: type /tool hook, /tool script, /tool thumbnail, or /tool captions, followed by a topic.',
  'Amazon: ask for an affiliate link or paste an Amazon product URL or ASIN.',
  'Saved Agents: type /run followed by the name of your agent.',
].join('\n\n');

function urlsIn(text: string): string[] {
  return [
    ...new Set(
      (text.match(/https?:\/\/[^\s<>"\x60\]]+/gi) || [])
        .map((raw) => raw.replace(/[.,;!?)]+$/, ''))
        .filter(isSafePublicHttpUrl)
    ),
  ];
}

function previousDestinations(history: ChatMessage[]): string[] {
  for (const message of [...history].reverse()) {
    if (message.role === 'assistant') {
      const saved = message.meta?.affiliateLinks;
      if (Array.isArray(saved)) {
        const urls = saved.filter((url): url is string => typeof url === 'string' && isSafePublicHttpUrl(url));
        if (urls.length) return [...new Set(urls)];
      }
      // Tagged URLs generated before chat stored structured affiliate results.
      if (/^(Tagged product link \(|Amazon matches for “)/.test(message.content)) {
        const urls = urlsIn(message.content).filter((url) => isAmazonDestination(new URL(url).hostname));
        if (urls.length) return urls;
      }
    } else {
      const urls = urlsIn(message.content);
      if (urls.length) return urls;
    }
  }
  return [];
}

export function isShortenRequest(input: string): boolean {
  if (/\b(?:don['’]t|do not|without|never)\b/i.test(input)) return false;
  const request = input
    .trim()
    .replace(/^(?:can|could|would) (?:you|i)\s+/i, '')
    .replace(/^please\s+/i, '');
  const link = /\bshort(?:er|ened)?[ -]+(?:amazon[ -]+)?(?:affiliate[ -]+)?(?:link|url)\b/i;
  return (
    /^\/shorten(?:\s|$)/i.test(request) ||
    /^shorten(?:[.!?]*$|\s+(?:https?:\/\/|this\b|it\b|[^.!?\n]{0,25}\b(?:link|url)\b))/i.test(request) ||
    (/^(?:i\s+)?(?:make|create|generate|give|get|need|want|build|turn|convert|have)\b/i.test(request) &&
      link.test(request.split(/\n|https?:\/\//i, 1)[0])) ||
    /^short(?:ened)?[ -]+(?:amazon[ -]+)?(?:affiliate[ -]+)?(?:link|url)(?:[?.!\s]*$|\s+https?:\/\/)/i.test(request)
  );
}

function shortSlug(input: string, origin: string): string | undefined {
  if (/^[\w-]{2,64}$/.test(input)) return input;
  const url = URL.parse(input);
  if (url?.origin !== origin) return;
  return /^\/s\/([\w-]{2,64})$/.exec(url.pathname)?.[1];
}

export async function runChatTool(options: {
  env: Env;
  creator: Creator;
  message: string;
  history: ChatMessage[];
  origin: string;
  topic?: string;
  productReference?: string;
}): Promise<ToolResult | null> {
  const { env, creator, message, history, origin, topic, productReference } = options;
  const input = message.trim();
  if (/^(?:\/tools|(?:show|list) (?:my |available )?(?:chat )?tools)[?.!]*$/i.test(input)) {
    return { reply: CHAT_TOOLS_HELP };
  }
  if (/^\/link-stats(?:\s|$)|\b(?:clicks|analytics|stats)\b.{0,45}\bshort[ -]link\b/i.test(input)) {
    const explicit = input.match(/^\/link-stats\s+(\S+)/i)?.[1] || urlsIn(input)[0];
    const last = [...history]
      .reverse()
      .find((item) => item.role === 'assistant' && typeof item.meta?.shortLink === 'string');
    const url = explicit || (last?.meta?.shortLink as string | undefined);
    const slug = url && shortSlug(url, origin);
    if (!slug) return { reply: 'Send a CreatorBrain short link or its slug with /link-stats.' };
    const link = await env.DB.prepare(
      'SELECT total_clicks, destination_domain FROM short_links WHERE creator_id = ? AND slug = ?'
    )
      .bind(creator.id, slug)
      .first<Pick<ShortLink, 'total_clicks' | 'destination_domain'>>();
    if (!link) return { reply: 'I couldn’t find that short link in your workspace.' };
    return {
      reply: `Your link to ${link.destination_domain} has ${link.total_clicks} tracked ${link.total_clicks === 1 ? 'click' : 'clicks'}.\n\n${origin}/s/${slug}`,
    };
  }
  if (isShortenRequest(input)) {
    const explicit = urlsIn(input);
    if (!explicit.length && /\bhttps?:\/\//i.test(input))
      return { reply: 'Paste a valid public HTTP or HTTPS URL to shorten.' };
    const asin = /(?:^|\s)([A-Z0-9]{10})(?:[.?!\s]|$)/i.exec(input)?.[1];
    const exactAsin = asin && /\d/.test(asin) ? asin : undefined;
    const named = /\b(?:link|url)\s+for\s+(.+)$/i.exec(input)?.[1];
    if (
      named &&
      !explicit.length &&
      !exactAsin &&
      !/^(this|that|the (?:current )?project|it|the (?:amazon )?(?:link|product|url) (?:above|in this project))\b/i.test(
        named
      )
    ) {
      return { reply: 'Paste the exact URL or ASIN you want me to shorten.' };
    }
    const recent = explicit.length || exactAsin ? [] : previousDestinations(history);
    const candidates = explicit.length
      ? explicit
      : exactAsin
        ? [exactAsin]
        : recent.length
          ? recent
          : productReference
            ? [productReference]
            : [];
    if (candidates.length !== 1) {
      return {
        reply: candidates.length
          ? 'I found more than one URL in the last result. Paste the exact URL you want shortened.'
          : 'Paste the URL you want shortened. For an Amazon product, you can also give its ASIN.',
      };
    }
    let destination = candidates[0];
    // The previous reply already has the exact affiliate URL. Use it as-is.
    if (
      /affiliate/i.test(input) ||
      destination === productReference ||
      destination === exactAsin ||
      (isSafePublicHttpUrl(destination) && !new URL(destination).searchParams.has('tag'))
    ) {
      const url = URL.parse(destination);
      if (url && !isAmazonDestination(url.hostname) && /affiliate/i.test(input)) {
        return { reply: 'Paste an Amazon product URL or ASIN to create an Amazon affiliate short link.' };
      }
      if (!url || isAmazonDestination(url.hostname)) {
        const amazon = await amazonClientFor(env.DB, env, creator.id);
        const product = amazonProductUrl(destination, amazon.getMarketplace());
        const tagged = product && tagAmazonProduct(product.href, amazon.getMarketplace(), amazon.getPartnerTag());
        if (tagged) destination = tagged;
        else if (!url || /affiliate/i.test(input)) {
          return {
            reply: `Use an Amazon product URL from ${amazon.getMarketplace()} and save your tracking ID in Settings to make an affiliate short link.`,
          };
        }
      }
    }
    try {
      const saved = await saveShortLink(env, creator.id, origin, { destination_url: destination }, true);
      const amazon = isAmazonDestination(saved.shortLink.destination_domain);
      const reply = [
        `Saved to Short links · ${saved.shortLink.destination_domain}`,
        saved.shortUrl,
        ...(amazon
          ? [
              'Share this as an Amazon link. Visitors choose Open Amazon before continuing.',
              'As an Amazon Associate I earn from qualifying purchases.',
            ]
          : []),
      ].join('\n\n');
      return { reply, shortLink: saved.shortUrl, meta: { shortLink: saved.shortUrl } };
    } catch (error) {
      if (error instanceof ShortLinkError) return { reply: error.message };
      throw error;
    }
  }

  const quick =
    /^(?:\/tool\s+|(?:please\s+)?(?:run|use)\s+(?:the\s+)?)(hooks?|script|thumbnail|captions?)(?=\s|$)(?:\s+tool\b)?(?:\s+(?:for|on)\s+)?\s*(.*)$/is.exec(
      input
    );
  if (!quick) {
    return /^\/tool(?:\s|$)/i.test(input)
      ? { reply: 'Choose one of the Quick Tools: /tool hook, /tool script, /tool thumbnail, or /tool captions.' }
      : null;
  }
  const toolType = quickNames[quick[1].toLowerCase()];
  const draftTopic = quick[2].trim() || topic || '';
  const platform = /\binstagram\b/i.test(draftTopic)
    ? 'instagram'
    : /\breels?\b/i.test(draftTopic)
      ? 'reels'
      : /\bshorts?\b/i.test(draftTopic)
        ? 'shorts'
        : 'youtube';
  const args = ToolGeneratorSchema.safeParse({ toolType, topic: draftTopic, platform });
  if (!args.success)
    return { reply: 'Add a topic after the tool name, for example /tool hook for a first sourdough bake.' };
  try {
    return { reply: await runQuickTool(env, creator, args.data), meta: { tool: toolType } };
  } catch {
    return {
      reply:
        'Quick Tools could not generate a result. Check your AI provider and daily budget in Settings, then try again.',
    };
  }
}
