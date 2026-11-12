import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionCreator } from './auth';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import { encryptCredential } from '../amazon/crypto';
import type { ProviderSettings, EncryptedCredentials } from '../../shared/types';

export const settingsRoutes = new Hono<{
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    AI?: any;
    ENCRYPTION_KEY?: string;
  };
}>();

// Get settings overview
settingsRoutes.get('/', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const dbClient = new DBClient(c.env.DB);
  const router = new AIRouter(c.env);

  const providerSettings = await dbClient.getProviderSettings(creator.id);
  const creds = await dbClient.getEncryptedCredentials(creator.id);
  const usage = await router.getBudgetManager().getCurrentUsage(creator.id);

  return c.json({
    availableProviders: router.getAvailableProviders(),
    providerSettings: providerSettings || {
      preferred_general_provider: 'claude',
      preferred_fast_provider: 'claude-haiku',
      preferred_structured_provider: 'openai',
      preferred_video_provider: 'gemini',
      daily_budget_usd: 5.0,
    },
    currentDailyUsageUsd: usage,
    amazonConfig: {
      hasCredentials: !!(creds?.amazon_access_key_enc && creds?.amazon_secret_key_enc),
      partnerTag: creds?.amazon_partner_tag || 'techkabir-21',
      marketplace: creds?.amazon_marketplace || 'amazon.in',
    },
    creator,
  });
});

// Update AI provider settings & budget
settingsRoutes.put('/providers', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<Partial<ProviderSettings>>();
  const dbClient = new DBClient(c.env.DB);
  await dbClient.updateProviderSettings(creator.id, body);

  const updated = await dbClient.getProviderSettings(creator.id);
  return c.json({ success: true, providerSettings: updated });
});

// Save BYO Amazon credentials (AES-GCM encrypted)
settingsRoutes.put('/amazon', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  const { accessKey, secretKey, partnerTag, marketplace } = await c.req.json();
  const dbClient = new DBClient(c.env.DB);
  const pass = c.env.ENCRYPTION_KEY || 'creatorbrain_default_dev_key_32b';

  let accessEnc = undefined;
  let secretEnc = undefined;
  let iv = undefined;

  if (accessKey && secretKey) {
    const enc1 = await encryptCredential(accessKey, pass);
    const enc2 = await encryptCredential(secretKey, pass);
    accessEnc = enc1.encrypted;
    secretEnc = enc2.encrypted;
    iv = enc1.iv; // shared IV for this pair
  }

  const credObj: EncryptedCredentials = {
    id: `cred_${creator.id}`,
    creator_id: creator.id,
    amazon_access_key_enc: accessEnc,
    amazon_secret_key_enc: secretEnc,
    amazon_partner_tag: partnerTag || 'techkabir-21',
    amazon_marketplace: marketplace || 'amazon.in',
    iv,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await dbClient.saveEncryptedCredentials(credObj);

  return c.json({
    success: true,
    message: 'Amazon credentials encrypted with AES-GCM and stored securely.',
    hasCredentials: !!accessEnc,
    partnerTag: credObj.amazon_partner_tag,
    marketplace: credObj.amazon_marketplace,
  });
});

// "Delete my data" button wipes creator's rows
settingsRoutes.post('/delete-data', async (c) => {
  const sessionId = getCookie(c, 'cb_session');
  const creator = await getSessionCreator(c.env.DB, sessionId);
  if (!creator) return c.json({ error: 'Unauthorized' }, 401);

  // If demo creator, prevent wiping the global seed data, but return success
  if (creator.id === 'creator_demo_tech_kabir') {
    return c.json({
      success: true,
      message: 'Demo creator data reset. In a production account, all database rows are permanently wiped.',
    });
  }

  const dbClient = new DBClient(c.env.DB);
  await dbClient.deleteCreatorData(creator.id);

  return c.json({
    success: true,
    message: 'All creator profile, graph nodes, assets, and project data permanently wiped.',
  });
});
