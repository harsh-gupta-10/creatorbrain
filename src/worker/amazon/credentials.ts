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
  credentialId?: string;
  credentialSecret?: string;
  credentialVersion?: '3.1' | '3.2' | '3.3';
  /** Legacy PA-API 5 credentials retained for existing accounts. */
  accessKey?: string;
  secretKey?: string;
}

export interface AmazonCredentials {
  partnerTag: string;
  marketplace: string;
  credentialId?: string;
  credentialSecret?: string;
  credentialVersion?: '3.1' | '3.2' | '3.3';
  accessKey?: string;
  secretKey?: string;
}

interface Row {
  amazon_partner_tag: string | null;
  amazon_access_key_enc: string | null;
  amazon_secret_key_enc: string | null;
  amazon_marketplace: string | null;
  amazon_creator_credential_id_enc: string | null;
  amazon_creator_credential_secret_enc: string | null;
  amazon_creator_credential_version: string | null;
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
  const [credentialId, credentialSecret] = await Promise.all([
    seal('creator_credential_id', input.credentialId),
    seal('creator_credential_secret', input.credentialSecret),
  ]);

  const ts = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO credentials_encrypted (
         id, creator_id, amazon_partner_tag, amazon_access_key_enc, amazon_secret_key_enc,
         amazon_marketplace, amazon_creator_credential_id_enc, amazon_creator_credential_secret_enc,
         amazon_creator_credential_version, iv, created_at, updated_at
       )
       VALUES (?1, ?2, ?3, ?4, ?5, COALESCE(?6, 'amazon.com'), ?8, ?9, ?7, NULL, ?10, ?10)
       ON CONFLICT (creator_id) DO UPDATE SET
         amazon_partner_tag = CASE WHEN ?11 THEN excluded.amazon_partner_tag ELSE amazon_partner_tag END,
         amazon_access_key_enc = CASE WHEN ?12 THEN excluded.amazon_access_key_enc ELSE amazon_access_key_enc END,
         amazon_secret_key_enc = CASE WHEN ?13 THEN excluded.amazon_secret_key_enc ELSE amazon_secret_key_enc END,
         amazon_creator_credential_id_enc = CASE WHEN ?14 THEN excluded.amazon_creator_credential_id_enc ELSE amazon_creator_credential_id_enc END,
         amazon_creator_credential_secret_enc = CASE WHEN ?15 THEN excluded.amazon_creator_credential_secret_enc ELSE amazon_creator_credential_secret_enc END,
         amazon_creator_credential_version = COALESCE(?7, amazon_creator_credential_version),
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
      input.credentialVersion ?? null,
      credentialId ?? null,
      credentialSecret ?? null,
      ts,
      tag !== undefined ? 1 : 0,
      access !== undefined ? 1 : 0,
      secretKey !== undefined ? 1 : 0,
      credentialId !== undefined ? 1 : 0,
      credentialSecret !== undefined ? 1 : 0
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
      `SELECT amazon_partner_tag, amazon_access_key_enc, amazon_secret_key_enc, amazon_marketplace,
              amazon_creator_credential_id_enc, amazon_creator_credential_secret_enc, amazon_creator_credential_version
       FROM credentials_encrypted WHERE creator_id = ?`
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

  const [partnerTag, accessKey, secretKey, credentialId, credentialSecret] = await Promise.all([
    open('partner_tag', row.amazon_partner_tag),
    open('access_key', row.amazon_access_key_enc),
    open('secret_key', row.amazon_secret_key_enc),
    open('creator_credential_id', row.amazon_creator_credential_id_enc),
    open('creator_credential_secret', row.amazon_creator_credential_secret_enc),
  ]);

  if (row.amazon_partner_tag && !isEncrypted(row.amazon_partner_tag) && partnerTag) {
    await saveAmazonCredentials(db, env, creatorId, { partnerTag });
  }

  const credentialVersion = normalizeCredentialVersion(row.amazon_creator_credential_version || undefined);
  return {
    partnerTag: partnerTag || '',
    marketplace: row.amazon_marketplace || 'amazon.com',
    credentialId,
    credentialSecret,
    credentialVersion,
    accessKey,
    secretKey,
  };
}

/** A client scoped to one creator: tags links with their own ID, uses their own API keys */
export async function amazonClientFor(
  db: D1Database,
  env: CryptoEnv,
  creatorId: string
): Promise<AmazonCreatorsClient> {
  const creds = await loadAmazonCredentials(db, env, creatorId).catch(() => null);
  return new AmazonCreatorsClient(
    creds
      ? {
          partnerTag: creds.partnerTag,
          marketplace: creds.marketplace,
          credentialId: creds.credentialId,
          credentialSecret: creds.credentialSecret,
          credentialVersion: creds.credentialVersion,
          accessKey: creds.accessKey,
          secretKey: creds.secretKey,
        }
      : undefined
  );
}

/** What the browser may see: never the keys themselves */
export function describeCredentials(creds: AmazonCredentials | null) {
  const hasCreatorsCredentials = !!(creds?.credentialId && creds?.credentialSecret && creds?.credentialVersion);
  const hasLegacyCredentials = !!(creds?.accessKey && creds?.secretKey);
  return {
    hasCredentials: hasCreatorsCredentials || hasLegacyCredentials,
    apiType: hasCreatorsCredentials ? 'creators' : hasLegacyCredentials ? 'paapi' : null,
    partnerTag: creds?.partnerTag || '',
    marketplace: creds?.marketplace || 'amazon.com',
    credentialIdHint: creds?.credentialId ? `••••${creds.credentialId.slice(-4)}` : '',
    credentialVersion: creds?.credentialVersion || '',
    accessKeyHint: creds?.accessKey ? `••••${creds.accessKey.slice(-4)}` : '',
  };
}

export function normalizeCredentialVersion(value?: string): '3.1' | '3.2' | '3.3' | undefined {
  const normalized = value?.trim().replace(/^v/i, '');
  return normalized === '3.1' || normalized === '3.2' || normalized === '3.3' ? normalized : undefined;
}
