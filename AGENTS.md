# CreatorBrain Agent Guide

## Project overview

CreatorBrain is a creator-focused workspace for studying YouTube content, building a Creator DNA profile, drafting content, and managing creator monetization. It is a TypeScript monorepo-style app in one package:

- `src/client/`: React 19 + Vite single-page app.
- `src/worker/`: Hono API and Cloudflare Worker implementation.
- `src/shared/`: types and Zod schemas shared by client and Worker.
- `migrations/`: ordered Cloudflare D1 SQL migrations and sample workspace data.
- `tests/`: Vitest unit and API tests.
- `public/`: static public assets and headers.

The Worker uses D1 (`DB`), KV (`KV`), Workers AI (`AI`), and static assets (`ASSETS`). Local runtime and deployment bindings are configured in `wrangler.jsonc`.

## Where to look

- App routing, signed-in shell, and navigation: `src/client/App.tsx`
- Browser API client and response types: `src/client/lib/api.ts`
- Shared models and request schemas: `src/shared/types.ts`
- Worker setup, route registration, scheduled work, and public page handling: `src/worker/index.ts`
- Authentication, creator scoping, sample-workspace write protection, and response headers: `src/worker/middleware.ts`, `src/worker/routes/auth.ts`
- Database access helpers: `src/worker/db/queries.ts`
- AI provider fallback and budgets: `src/worker/ai/`
- Bounded agent runner and agent definitions: `src/worker/agents/`
- YouTube ingestion and transcript parsing: `src/worker/content/youtube.ts`
- Content analysis and public audit: `src/worker/content/`
- Feature APIs: `src/worker/routes/`
- User-facing screens: `src/client/pages/`

## Implementation conventions

- Keep TypeScript strict. Avoid `any`; use shared types and narrow unknown input before use.
- Validate request bodies, query values, and agent tool inputs with the Zod schemas in `src/shared/types.ts` or a focused schema near the feature.
- Keep browser code calling the Worker through `src/client/lib/api.ts`. Provider credentials and other secrets must stay in Worker bindings and server-side code.
- Scope every creator-owned database read, update, and delete to the authenticated `creator.id`. Do not trust a creator ID supplied by the browser.
- Preserve the shared sample workspace as read-only. Write protection is enforced in middleware; do not bypass it in a route or client screen.
- For longer channel studies, keep work resumable and bounded per request. Respect Cloudflare Worker CPU and request limits rather than processing an entire channel in one invocation.
- Use the existing AI router for model calls and the agent runner for bounded tool loops. Validate tool arguments, handle provider failures, and avoid treating generated output as verified facts.
- Keep migrations additive and ordered. Do not edit a migration that may already have been applied; add a new migration for schema changes. Include indexes for new creator-scoped lookups where appropriate.
- Keep UI styling consistent with the existing Tailwind utility classes and CSS tokens in `src/client/index.css`. Use the shared UI components in `src/client/components/ui.tsx` where they fit.
- Keep user-visible feature claims aligned with working behavior. Mark demo/mock data clearly and do not present it as live provider data.

## Security and data handling

- Authentication/session resolution and sample-workspace protection live in middleware. Preserve those checks when adding API routes.
- Write requests are protected by same-origin validation. Do not add cross-origin write exceptions without a clear product need and equivalent CSRF protection.
- Amazon credentials use the encryption helpers in `src/worker/amazon/`. Never return plaintext credentials to the client, place them in logs, or store them in ordinary creator profile JSON.
- Treat external URLs, imported CSV content, transcripts, and model output as untrusted input. Reuse existing URL validation and schema checks rather than interpolating raw values into SQL or HTML.
- Use parameterized D1 statements. Keep API responses free of secrets and avoid logging sensitive request bodies.

## Useful commands

- `npm run dev` — start Vite development server; API routes proxy to the local Worker.
- `npm run dev:worker` — run Wrangler Worker locally.
- `npm run db:migrate:local` — apply D1 migrations locally.
- `npm run typecheck` — run TypeScript checks.
- `npm test` — run Vitest.
- `npm run build` — build the client assets.
- `npm run check` — typecheck, test, and build.

Do not run tests or builds unless the task asks for verification or the change requires it.

## Product context

Current product areas include the dashboard, Copilot, Content Studio, quick tools, link-in-bio, short links, Amazon affiliate management, brand deals, content library, Creator Brain graph, lessons, assessments, agent activity, and settings. The ingestion and study pipeline is YouTube-focused; do not assume an Instagram handle means Instagram content is currently imported or analyzed.

When adding features, prefer connecting existing creator data and workflows (content items, transcripts, graph evidence, projects, assets, links, and earnings) over creating a disconnected AI screen. Keep recommendations grounded in stored evidence and distinguish measured performance from heuristic estimates.
