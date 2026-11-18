const BLOCKED_HOSTS = ['phishing.com', 'malware.ru', 'scam.link', 'grabify.link'];

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;

  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isBlockedIpv6(host: string): boolean {
  if (!host.startsWith('[') || !host.endsWith(']')) return false;
  const address = host.slice(1, -1).toLowerCase();

  // Permit only global unicast IPv6 addresses. This excludes loopback, link-local,
  // unique-local, multicast, unspecified, and IPv4-mapped destinations.
  const firstHextet = Number.parseInt(address.split(':', 1)[0] || '0', 16);
  const globalUnicast = firstHextet >= 0x2000 && firstHextet <= 0x3fff;
  return !globalUnicast || address.startsWith('2001:db8:');
}

/** Accept only public HTTP(S) destinations suitable for short-link redirects. */
export function isSafePublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return false;

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      isBlockedIpv4(host) ||
      isBlockedIpv6(host) ||
      BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/** Normalize a creator-provided href and prevent protocol-relative or script URLs. */
export function safePublicHref(value: string, baseOrigin: string): string {
  const input = value.trim();
  if (!input) return '#';

  try {
    const base = new URL(baseOrigin);
    const target = new URL(input, base);
    if ((target.protocol !== 'http:' && target.protocol !== 'https:') || target.username || target.password) {
      return '#';
    }

    if (target.origin === base.origin) return `${target.pathname}${target.search}${target.hash}`;
    // A slash-prefixed value is intended to be same-origin. Reject URL parser
    // variations such as //external.example and /\\external.example.
    if (input.startsWith('/') || input.startsWith('\\') || !isSafePublicHttpUrl(target.href)) return '#';
    return target.href;
  } catch {
    return '#';
  }
}
