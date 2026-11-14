// Per-creator Amazon Associates credentials. Every field is encrypted at rest in D1;
// nothing creator-specific lives in environment variables.

import { decryptSecret, encryptSecret, isEncrypted, resolveMasterSecret } from './crypto';
import { AmazonCreatorsClient } from './client';

export interface CryptoEnv {
  ENCRYPTION_KEY?: string;
  ENVIRONMENT?: string;
}

export interface AmazonCredentialInput {
  partnerTag?: string;
  marketplace?: string;
  accessKey?: string;
  secretKey?: string;
}

export interface AmazonCredentials {
  partnerTag: string;
  marketplace: string;
  accessKey?: string;
  secretKey?: string;
}

interface Row {
  amazon_partner_tag: string | null;
  amazon_access_key_enc: string | null;
  amazon_secret_key_enc: string | null;
  amazon_marketplace: string | null;
}

export const MARKETPLACES = ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.ca'] as const;
export const PARTNER_TAG_RE = /^[\w-]{3,40}$/;

const ctx = (creatorId: string, field: string) => `${creatorId}:${field}`;

/**
 * Upserts credentials. Omitted fields keep their stored value; an empty string clears it.
 */
export async function saveAmazonCredentials(
  db: D1Database,
  env: CryptoEnv,
  creatorId: string,
  input: AmazonCredentialInput
): Promise<void> {
  const secret = resolveMasterSecret(env);
  const seal = async (field: string, value: string | undefined) =>
    value === undefined ? undefined : value === '' ? null : encryptSecret(value, secret, ctx(creatorId, field));

  const [tag, access, secretKey] = await Promise.all([
    seal('partner_tag', input.partnerTag),
    seal('access_key', input.accessKey),
    seal('secret_key', input.secretKey),
  ]);

  const ts = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO credentials_encrypted (id, creator_id, amazon_partner_tag, amazon_access_key_enc, amazon_secret_key_enc, amazon_marketplace, iv, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, COALESCE(?6, 'amazon.com'), NULL, ?7, ?7)
       ON CONFLICT (creator_id) DO UPDATE SET
         amazon_partner_tag = CASE WHEN ?8 THEN excluded.amazon_partner_tag ELSE amazon_partner_tag END,
         amazon_access_key_enc = CASE WHEN ?9 THEN excluded.amazon_access_key_enc ELSE amazon_access_key_enc END,
         amazon_secret_key_enc = CASE WHEN ?10 THEN excluded.amazon_secret_key_enc ELSE amazon_secret_key_enc END,
         amazon_marketplace = COALESCE(?6, amazon_marketplace),
         iv = NULL,
         updated_at = excluded.updated_at`
    )
    .bind(
      `cred_${creatorId}`,
      creatorId,
      tag ?? null,
      access ?? null,
      secretKey ?? null,
      input.marketplace ?? null,
      ts,
      tag !== undefined ? 1 : 0,
      access !== undefined ? 1 : 0,
      secretKey !== undefined ? 1 : 0
    )
    .run();
}

export async function loadAmazonCredentials(
  db: D1Database,
  env: CryptoEnv,
  creatorId: string
): Promise<AmazonCredentials | null> {
  const row = await db
    .prepare(
      'SELECT amazon_partner_tag, amazon_access_key_enc, amazon_secret_key_enc, amazon_marketplace FROM credentials_encrypted WHERE creator_id = ?'
    )
    .bind(creatorId)
    .first<Row>();
  if (!row) return null;

  const secret = resolveMasterSecret(env);
  const open = async (field: string, value: string | null) => {
    if (!value) return undefined;
    // Rows written before encryption hold plaintext partner tags; read them and re-seal below
    if (!isEncrypted(value)) return field === 'partner_tag' ? value : undefined;
    try {
      return await decryptSecret(value, secret, ctx(creatorId, field));
    } catch {
      console.warn(`[credentials] could not decrypt ${field} for ${creatorId}`);
      return undefined;
    }
  };

  const [partnerTag, accessKey, secretKey] = await Promise.all([
    open('partner_tag', row.amazon_partner_tag),
    open('access_key', row.amazon_access_key_enc),
    open('secret_key', row.amazon_secret_key_enc),
  ]);

  if (row.amazon_partner_tag && !isEncrypted(row.amazon_partner_tag) && partnerTag) {
    await saveAmazonCredentials(db, env, creatorId, { partnerTag });
  }

  return { partnerTag: partnerTag || '', marketplace: row.amazon_marketplace || 'amazon.com', accessKey, secretKey };
}

/** A client scoped to one creator: tags links with their own ID, uses their own API keys */
export async function amazonClientFor(db: D1Database, env: CryptoEnv, creatorId: string): Promise<AmazonCreatorsClient> {
  const creds = await loadAmazonCredentials(db, env, creatorId).catch(() => null);
  return new AmazonCreatorsClient(
    creds ? { partnerTag: creds.partnerTag, marketplace: creds.marketplace, accessKey: creds.accessKey, secretKey: creds.secretKey } : undefined
  );
}

/** What the browser may see: never the keys themselves */
export function describeCredentials(creds: AmazonCredentials | null) {
  return {
    hasCredentials: !!(creds?.accessKey && creds?.secretKey),
    partnerTag: creds?.partnerTag || '',
    marketplace: creds?.marketplace || 'amazon.com',
    accessKeyHint: creds?.accessKey ? `••••${creds.accessKey.slice(-4)}` : '',
  };
}
