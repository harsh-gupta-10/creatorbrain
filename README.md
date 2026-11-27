# CreatorBrain

CreatorBrain is a workspace for YouTube creators. Study your uploads, save what you learn in Brain, turn ideas into Studio projects, then manage and measure the links you share.

[Open CreatorBrain](https://creatorbrain.tech/) · [Run a YouTube channel audit](https://creatorbrain.tech/audit) · [GitHub repository](https://github.com/harsh-gupta-10/creatorbrain)

The landing page offers a read-only sample workspace.

## What you can do

| Area | Features |
| --- | --- |
| **Dashboard** | Review channel and link activity, see up to three actions in your weekly plan, and snooze work for seven days. |
| **Brain and Library** | Study public YouTube uploads and available captions. Explore findings with their sources, pin or correct what Brain learned, and save creator preferences. Find a Clip opens matching moments directly in YouTube. |
| **Copilot and Studio** | Turn ideas into projects, generate and edit versioned drafts, review script lines, export Markdown, and use your own channel examples in chat. Draft in English, Hindi, or Hinglish, or match the video's audio. |
| **Published Video Review** | Attach a studied upload to a Studio project. Review recorded views near day seven and compare them with similar uploads once the workspace has enough observations. |
| **Link in Bio and Short Links** | Publish a bio page with links and product cards. Short URLs redirect directly to their saved destination, including tagged Amazon URLs. Project Link Kits track clicks separately for descriptions, pinned comments, and bio placements. |
| **Amazon and Brand Deals** | Find affiliate products with Amazon Creators API credentials, build tagged links, import Associates earnings reports, and track sponsor deliverables and payments. |
| **Agents, Lessons, and Assessments** | Run saved writing agents, compare competitor upload snapshots, browse activity, and work through lessons or quizzes based on Brain findings. |

Use `/tools` in Studio or Copilot for chat commands. Try `/clips antenna`, `/insights`, or `/weekly-plan`. Studio also supports `/review-draft`, `/publication`, and `/link-kit <URL>`.

Studio’s Amazon link replies name the destination and include an affiliate disclosure. Short Links preserve the saved Amazon URL and its tracking tag when redirecting. [Amazon Associates linking requirements](https://affiliate-program.amazon.in/help/operating/linking)

## Studio experiments with Flagsmith

**Test Something Real.** The `studio_next_steps` flag compares general Studio prompts with prompts grounded in Brain findings and recorded analytics. Both versions use the same three-card layout. The hypothesis is that grounded prompts will lead more creators to send a suggested message. The primary metric is the share of exposed creators who select and send the original suggestion in Studio. The read-only sample, visits without Brain evidence, and active link follow-ups stay outside the test.

**AI Agents and Feature Flags.** Agents → Studio experiment operator reads the experiment, metric, and win probabilities directly from Flagsmith. The operator can ask to start, pause, refresh, or roll out a variant. CreatorBrain previews the exact action and waits for the signed-in operator’s approval. It rechecks the experiment before applying the change and rechecks the reported winner before ending the experiment on that basis.

### Connect Flagsmith

1. Create or select a Flagsmith project and environment. Enable its warehouse in **Environment Settings → Warehouse**.
2. Create and enable the multivariate flag `studio_next_steps`. Set the default string value to `control`. Add a string variant whose value and key are both `brain`. Give the variant 0% outside the experiment.
3. Create the occurrence metric **Studio suggestion sent** with event `studio_suggestion_sent` and direction **Increase**.
4. Create an experiment on that flag and metric. A 50/50 split of eligible traffic compares the two versions. Use this hypothesis: *Suggestions grounded in the creator’s Brain increase the share of exposed creators who send a suggested prompt.*
5. Put the settings below in your ignored `.dev.vars` for local development or in Worker secrets for the Cloudflare environment you intend to use. Apply migration `0014_studio_experiments.sql` before enabling the experiment.

| Setting | Purpose |
| --- | --- |
| `FLAGSMITH_SDK_KEY` | Flagsmith environment key for assignment and event delivery |
| `FLAGSMITH_IDENTITY_SECRET` | Stable random secret of at least 32 characters for pseudonymous assignments and signed event tickets |
| `FLAGSMITH_MANAGEMENT_KEY` | Server-only Flagsmith organisation API key for the operator |
| `FLAGSMITH_EXPERIMENT_ID` | Numeric ID of the experiment |
| `FLAGSMITH_OPERATOR_CREATOR_ID` | Immutable CreatorBrain account ID allowed to approve changes. Use the account’s `creator.id` returned by `GET /api/auth/me`. |
| `FLAGSMITH_PROJECT_ID` | Optional numeric Flagsmith project ID for a link to the cloud dashboard |

For a self-hosted setup, set `FLAGSMITH_EDGE_API` and `FLAGSMITH_MANAGEMENT_API` to its API base ending in `/api/v1/`, and `FLAGSMITH_EVENTS_API` to the ingestion base. For the built-in local warehouse this is `http://localhost:8000/api/`. Cloud deployments require HTTPS.

### Verify the test

- Start the test from Flagsmith or ask the Studio experiment operator to start it and approve the preview.
- Sign in with a CreatorBrain account, study a channel, and open a Studio project when it has Brain-backed suggestions. An exposure is recorded when the cards appear in view. Click a card and send its prompt through Studio to record conversion.
- Read results in the Flagsmith dashboard or operator console. CreatorBrain recommends rolling out a winner only after at least 100 exposed creators in each group, a 95% win probability, and no detected sample ratio mismatch.
- To demonstrate the results pipeline with synthetic users, run `npm run experiment:simulate -- 400` with `FLAGSMITH_SIMULATION_SDK_KEY` set to a **separate** Flagsmith environment running the same experiment. The script marks events as simulated and deliberately gives one variant a higher conversion rate. Use the resulting numbers to demonstrate delivery, never as evidence of creator behavior.

Flagsmith receives a pseudonymous identity, the assigned variant on exposure, and the conversion event name. CreatorBrain keeps account details, project copy, transcripts, and chat text inside the app.

[Flagsmith experimentation setup](https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent) · [Toggle Wars rules](https://www.wemakedevs.org/hackathons/flagsmith/rules)


## Architecture

| Component | Responsibility |
| --- | --- |
| [React and Vite client](./src/client/) | Creator workspace, onboarding, public-facing entry pages, and the API client. |
| [Hono Worker](./src/worker/) | Authenticated APIs, public bio pages, short-link redirects, and scheduled channel updates. |
| [Cloudflare D1](./migrations/) | Creator data, transcripts, Brain findings, versioned drafts, link analytics, and reusable workspace results. |
| Cloudflare KV, R2, and Static Assets | Short-link lookup cache and AI budget counters, uploaded bio icons, and the compiled web app. |
| [AI providers](./src/worker/ai/) | Anthropic, OpenAI, and Workers AI for generation. Gemini is used for supported video-analysis paths. |

CreatorBrain reuses successful results when the creator, request, and relevant inputs match. Duplicate requests already in progress do not start another generation. Clip search, link reporting, and the weekly plan use stored data without a model call.

Creator data is scoped to signed-in accounts. Sessions are stored in HTTP-only cookies, cross-origin API writes are restricted, and the shared sample workspace is read-only. Creator-owned Amazon credentials are encrypted in D1. Short links validate destinations and record clicks asynchronously. Flagsmith management credentials stay in the Worker.

## Local development

Use npm and a Node.js version supported by the project’s Cloudflare CLI. Node **22.23+** or **24.22+** is suitable. [Cloudflare CLI setup](https://developers.cloudflare.com/cf/get-started/)

```bash
git clone https://github.com/harsh-gupta-10/creatorbrain.git
cd creatorbrain
npm ci
cp .dev.vars.example .dev.vars
```

Set `ENCRYPTION_KEY` in the ignored `.dev.vars` if you want to save Amazon credentials locally. Generate a value with `openssl rand -base64 48`. The template lists the optional YouTube, AI provider, and Flagsmith settings.

```bash
npm run db:migrate:local
npm run build
npm run dev:worker
```

Open the local URL printed by the Worker. For frontend development, keep the Worker running and use `npm run dev` in a second terminal.

## Verification

```bash
npm run check
npm run test:e2e
```

The first command runs ESLint, TypeScript, unit tests, and the production client build. The second runs the Worker API suite against a fresh local D1 database. GitHub CI runs lint, type checks, unit tests, and the client build.

## Deploy to Cloudflare Workers

`cloudflare.config.ts` defines the Worker, production bindings, and cron trigger. For your own Cloudflare account, set its account and resource IDs there and use the matching D1 database ID in the migration commands in `package.json`. Configure production secrets in the Cloudflare Worker settings. The local `.dev.vars` file stays on your machine.

```bash
npx cf auth login
npm run build
npm run deploy -- --dry-run
npm run db:migrate:remote
npm run deploy
```

Check `/api/health` at the deployed URL. The Flagsmith experiment starts collecting only after you connect a warehouse, configure the Worker bindings, and start the experiment in Flagsmith. [Cloudflare deployment documentation](https://developers.cloudflare.com/cf/projects/)

## License and credits

[MIT License](./LICENSE). Built by [Harsh Gupta](https://github.com/harsh-gupta-10). Interface design guidance from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky.
