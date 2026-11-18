/**
 * AES-GCM-256 encryption for per-creator secrets stored in D1.
 *
 * - The master key comes from the ENCRYPTION_KEY Worker secret (`wrangler secret put ENCRYPTION_KEY`).
 * - Each value gets its own random 96-bit IV; IVs are never reused.
 * - The creator id is bound as additional authenticated data, so a ciphertext
 *   copied into another creator's row fails to decrypt.
 * - HKDF (not PBKDF2) derives the AES key: the master secret is already high-entropy,
 *   and HKDF keeps each request well inside the Workers free tier CPU budget.
 *
 * Stored format: "v1:<base64 iv>:<base64 ciphertext+tag>"
 */

const VERSION = 'v1';
const DEV_FALLBACK = 'creatorbrain-local-development-only-key';
const keyCache = new Map<string, Promise<CryptoKey>>();

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super('ENCRYPTION_KEY is not configured. Set it with `wrangler secret put ENCRYPTION_KEY`');
  }
}

/** Returns the master secret, refusing the dev fallback outside local development */
export function resolveMasterSecret(env: { ENCRYPTION_KEY?: string; ENVIRONMENT?: string }): string {
  if (env.ENCRYPTION_KEY && env.ENCRYPTION_KEY.length >= 32) return env.ENCRYPTION_KEY;
  if (env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'test') return DEV_FALLBACK;
  throw new MissingEncryptionKeyError();
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = (async () => {
      const material = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: enc.encode('creatorbrain/credentials'),
          info: enc.encode('aes-gcm-256/v1'),
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    })();
    keyCache.set(secret, key);
  }
  return key;
}

export async function encryptSecret(plaintext: string, secret: string, context: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(context) },
    key,
    enc.encode(plaintext)
  );
  return `${VERSION}:${toB64(iv)}:${toB64(new Uint8Array(ct))}`;
}

export async function decryptSecret(payload: string, secret: string, context: string): Promise<string> {
  const [version, ivB64, ctB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !ctB64) throw new Error('Unsupported ciphertext format');
  const key = await getKey(secret);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64), additionalData: enc.encode(context) },
    key,
    fromB64(ctB64)
  );
  return dec.decode(pt);
}

export function isEncrypted(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}
