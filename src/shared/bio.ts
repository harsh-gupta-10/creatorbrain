/** Read a custom link icon from the existing block content JSON. */
export function bioIconUrlFromContent(content?: string | null): string | undefined {
  if (!content) return undefined;
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const iconUrl = (parsed as Record<string, unknown>).iconUrl;
    return typeof iconUrl === 'string' && iconUrl.trim() ? iconUrl.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Preserve other block content while updating or clearing its custom icon. */
export function contentWithBioIcon(content: string | null | undefined, iconUrl?: string): string | null {
  let parsed: Record<string, unknown> = {};
  if (content) {
    try {
      const value: unknown = JSON.parse(content);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        parsed = { ...(value as Record<string, unknown>) };
      }
    } catch {
      // Ignore invalid legacy content; new values are serialized consistently below.
    }
  }

  if (iconUrl?.trim()) parsed.iconUrl = iconUrl.trim();
  else delete parsed.iconUrl;

  return Object.keys(parsed).length ? JSON.stringify(parsed) : null;
}

/** Ask Google's favicon service for the site icon associated with a creator's link. */
export function automaticLinkIcon(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const target = new URL(url);
    if ((target.protocol !== 'http:' && target.protocol !== 'https:') || target.username || target.password) {
      return undefined;
    }
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(target.origin)}&sz=64`;
  } catch {
    return undefined;
  }
}
