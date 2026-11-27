import { bindings, defineConfig, triggers } from 'cf/config';

/**
 * Secret-like files were detected but not read or migrated: .dev.vars, .dev.vars.example, .env.example. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

export default defineConfig({
  accountId: 'b1d481965d10a5b83a86f3ba67c2e0ed',
  worker: {
    name: 'creatorbrain',
    compatibilityDate: '2026-11-12',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'src/worker/index.ts',
    observability: {
      enabled: true,
      traces: {
        enabled: true,
      },
    },
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/api/*', '/bio-icons/*', '/s/*', '/@*', '/%40*'],
    },
    triggers: [
      triggers.scheduled({
        schedule: '0 0 * * *',
      }),
    ],
    env: {
      ENVIRONMENT: bindings.text('production'),
      ANTHROPIC_MODEL: bindings.text('claude-sonnet-5-5'),
      ANTHROPIC_FAST_MODEL: bindings.text('claude-haiku-5-5'),
      OPENAI_MODEL: bindings.text('gpt-4o-mini'),
      GEMINI_MODEL: bindings.text('gemini-2.5-flash'),
      DB: bindings.d1({
        name: 'creatorbrain-db',
        id: '52e33f46-f0f0-47ac-b2d0-c56825ea330c',
      }),
      KV: bindings.kv({
        id: '202e40b4c38c4492aee3e00904d092f3',
      }),
      BIO_ICONS: bindings.r2({
        name: 'creatorbrain-bio-icons',
      }),
      AI: bindings.ai({}),
      AUTH_LIMITER: bindings.rateLimit({
        namespace: '1001',
        simple: {
          limit: 10,
          period: 60,
        },
      }),
      ASSETS: bindings.assets(),
    },
    // D1 migration files use the default ./migrations directory. Apply with cf d1 migrations apply <database-id>.
  },
});
