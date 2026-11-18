import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { DBClient } from '../db/queries';
import { AIRouter } from '../ai/router';
import { z } from 'zod';
import {
  loadAmazonCredentials,
  saveAmazonCredentials,
  describeCredentials,
  MARKETPLACES,
  PARTNER_TAG_RE,
} from '../amazon/credentials';
import { SAMPLE_CREATOR_ID } from './auth';
import { SCRIPT_LANGUAGES } from '../lib/language';
import type { ProviderSettings } from '../../shared/types';

export const settingsRoutes = new Hono<AppEnv>();

// Get settings overview
settingsRoutes.get('/', async (c) => {
  const creator = c.get('creator');

  const dbClient = new DBClient(c.env.DB);
  const router = new AIRouter(c.env);

  const providerSettings = await dbClient.getProviderSettings(creator.id);
  const creds = await loadAmazonCredentials(c.env.DB, c.env, creator.id).catch(() => null);
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
    amazonConfig: describeCredentials(creds),
    creator,
    monetization: {
      ...safeJson(creator.monetization_json, {}),
      partnerTag: creds?.partnerTag || '',
      marketplace: creds?.marketplace,
    },
    goals: safeJson(creator.goals_json, []),
  });
});

const Marketplace = z.enum(MARKETPLACES);

const MonetizationSchema = z
  .object({
    amazon: z.boolean().default(false),
    partnerTag: z.string().trim().max(40).optional().default(''),
    marketplace: Marketplace.default('amazon.com'),
    other: z.array(z.string().max(40)).max(8).default([]),
  })
  .refine((v) => !v.amazon || PARTNER_TAG_RE.test(v.partnerTag), {
    message: 'Enter your Amazon Associates tracking ID, like yourname-20',
  });

// Edit the monetization answers from onboarding. The tracking ID is encrypted, never stored in plain JSON
settingsRoutes.put('/monetization', async (c) => {
  const creator = c.get('creator');
  const parsed = MonetizationSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const { amazon, partnerTag, marketplace, other } = parsed.data;

  await c.env.DB.prepare('UPDATE creators SET monetization_json = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify({ amazon, marketplace, other }), new Date().toISOString(), creator.id)
    .run();
  if (amazon) await saveAmazonCredentials(c.env.DB, c.env, creator.id, { partnerTag, marketplace });

  return c.json({ success: true, monetization: { amazon, partnerTag: amazon ? partnerTag : '', marketplace, other } });
});

const PreferencesSchema = z.object({
  scriptLanguage: z.enum(SCRIPT_LANGUAGES).optional(),
  contentLanguage: z.string().trim().min(2).max(60).optional(),
});

// Writing preferences: which language drafts are written in, and what the videos are in
settingsRoutes.put('/preferences', async (c) => {
  const creator = c.get('creator');
  const parsed = PreferencesSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const { scriptLanguage, contentLanguage } = parsed.data;
  await c.env.DB.prepare(
    'UPDATE creators SET script_language = COALESCE(?, script_language), content_language = COALESCE(?, content_language), updated_at = ? WHERE id = ?'
  )
    .bind(scriptLanguage ?? null, contentLanguage ?? null, new Date().toISOString(), creator.id)
    .run();
  return c.json({
    success: true,
    scriptLanguage: scriptLanguage ?? creator.script_language,
    contentLanguage: contentLanguage ?? creator.content_language,
  });
});

// Update AI provider settings & budget
settingsRoutes.put('/providers', async (c) => {
  const creator = c.get('creator');

  const body = await c.req.json<Partial<ProviderSettings>>();
  const dbClient = new DBClient(c.env.DB);
  await dbClient.updateProviderSettings(creator.id, body);

  const updated = await dbClient.getProviderSettings(creator.id);
  return c.json({ success: true, providerSettings: updated });
});

const AmazonKeysSchema = z.object({
  partnerTag: z
    .string()
    .trim()
    .regex(PARTNER_TAG_RE, 'Tracking IDs use 3 to 40 letters, numbers and dashes')
    .optional(),
  marketplace: Marketplace.optional(),
  accessKey: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{16,128}$/, 'That access key does not look right')
    .optional()
    .or(z.literal('')),
  secretKey: z.string().trim().min(20, 'That secret key looks too short').max(256).optional().or(z.literal('')),
});

// Save the creator's own Amazon API keys and tracking ID, each encrypted with AES-GCM
settingsRoutes.put('/amazon', async (c) => {
  const creator = c.get('creator');
  const parsed = AmazonKeysSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message || 'Check the form' }, 400);
  const { partnerTag, marketplace, accessKey, secretKey } = parsed.data;
  if (!!accessKey !== !!secretKey) {
    return c.json({ error: 'Enter both the access key and the secret key' }, 400);
  }

  await saveAmazonCredentials(c.env.DB, c.env, creator.id, {
    partnerTag,
    marketplace,
    // Blank key fields keep the stored keys
    accessKey: accessKey || undefined,
    secretKey: secretKey || undefined,
  });
  const creds = await loadAmazonCredentials(c.env.DB, c.env, creator.id);
  return c.json({ success: true, message: 'Saved and encrypted', ...describeCredentials(creds) });
});

// Remove stored Amazon API keys (the tracking ID stays)
settingsRoutes.delete('/amazon/keys', async (c) => {
  const creator = c.get('creator');
  await saveAmazonCredentials(c.env.DB, c.env, creator.id, { accessKey: '', secretKey: '' });
  return c.json({ success: true });
});

// "Delete my data" button wipes creator's rows
settingsRoutes.post('/delete-data', async (c) => {
  const creator = c.get('creator');

  // If demo creator, prevent wiping the global seed data, but return success
  if (creator.id === SAMPLE_CREATOR_ID) {
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

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
