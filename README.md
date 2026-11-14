# CreatorBrain

An assistant for YouTube and Instagram creators that studies their published content, learns how they title, hook, talk and sell, and then drafts scripts, packaging and affiliate links in their voice.

**Live:** https://creatorbrain.harshgupta24716.workers.dev. Create an account with your own channel, or open the read-only sample workspace from the landing page.

| | |
|---|---|
| **Vertical** | Creator economy assistant |
| **Persona** | An independent YouTube or Instagram creator who publishes regularly, may earn through Amazon Associates, sponsorships or their own products, and wants each new video to build on what already worked |
| **Stack** | Cloudflare Workers (Hono), D1, KV, Workers AI, React 19, Tailwind v4, Vite |
| **Hosting cost** | Runs entirely on the Cloudflare free tier |

---

## The problem

Creators make the same decisions every week: what to make next, how to title it, how to open it, which products to link and how to disclose them. The evidence for those decisions is already in their own channel: which hooks held attention, which titles beat their median, which thumbnails they keep returning to. That evidence is spread across hundreds of videos, and general-purpose AI tools ignore it and write in a generic voice.

## Approach

CreatorBrain treats the creator's own back catalogue as the source of truth.

1. **Ask only what can't be inferred.** Signup is name, handle, email and password. Onboarding asks for the channel, niche, language, upload rhythm, how the creator earns (Amazon Associates or not, sponsorships, own products, memberships) and up to three goals.
2. **Study every video in depth.** For each upload it pulls the timestamped transcript, looks at the thumbnail with a vision model, and has a language model break down the hook, structure, topics, tone, pacing, calls to action, products mentioned, recurring phrases, title pattern, what worked and what to improve.
3. **Synthesize a Creator DNA** across all those breakdowns: voice, visual style, packaging patterns and audience, plus specific strengths and gaps, each tied to the videos that show it.
4. **Store it as a graph** (videos, topics, strengths, gaps, style and audience as nodes in D1) that the creator can browse and that every drafting feature reads from.
5. **Decide from context.** Suggestions, lessons and tools depend on what was learned and what the creator told us (logic below).
6. **Keep learning.** A daily cron job refreshes uploads, studies new videos and updates the Brain.

### Decision logic based on user context

| Context | What the assistant does |
|---|---|
| Creator does not use Amazon Associates | Hides the Amazon tab, leaves affiliate links and disclosures out of drafts, and skips the compliance lesson |
| Creator uses Amazon | Tags every product link with their own encrypted tracking ID, adds the disclosure in the first lines of descriptions, and plans a compliance lesson |
| Creator has their own Amazon API keys | Live product search through PA-API 5.0, signed with AWS SigV4; otherwise a clearly labelled sample catalog |
| A video beats the channel median | Recorded as a strength, with that video as evidence; its title and hook patterns feed the Studio |
| Titles run long, few use numbers, uploads are irregular, hooks are weak | Recorded as gaps; each gap maps to a lesson and a baseline quiz question |
| Goals chosen at signup | Passed to the synthesis prompt so strengths, gaps and lessons lean toward them |
| `GEMINI_API_KEY` set | Gemini watches each video and its thumbnail in one call, and transcribes videos that have no captions |
| No AI provider reachable | Falls back to transcript and view statistics. The study still finishes, and nothing is invented |
| Shared sample workspace | Readable, with every write blocked server-side |

## How it works

```
Browser (React SPA)                      Cloudflare Worker (Hono)
───────────────────                      ───────────────────────────────────────────
Signup ─► Onboarding ─► Study runner ──► /api/onboarding/study/step  (one step per request)
                                          fetch       YouTube Data API, or public RSS feed
                                          video ×N    captions ─► transcript (D1)
                                                      thumbnail ─► vision model
                                                      transcript + notes ─► LLM breakdown
                                          synthesize  Creator DNA + strengths/gaps ─► graph
                                          plan        lessons + baseline quiz
Dashboard · Library · Brain ◄──────────── /api/content, /api/brain, ...
Studio · Copilot · Tools    ◄──────────── AI router: Claude ► OpenAI ► Workers AI ► stats
Link in bio · Short links   ◄──────────── /@handle (server rendered), /s/:slug (KV + D1)
                                         Cron (daily): refresh uploads, study new videos
```

**Why one step per request:** the Workers free tier caps CPU time and subrequests per invocation. Each request does one bounded unit of work (one video, or one synthesis), so a 50-video channel never hits a limit. The browser drives the loop during onboarding, and the cron job and the Library's "Study waiting" button pick up the rest.

### Where the data comes from

| Data | Source | Key needed |
|---|---|---|
| Latest 15 uploads, views, likes | YouTube public RSS feed | No |
| Up to 50 uploads with duration, tags, comments | YouTube Data API v3 | `YOUTUBE_API_KEY` (optional) |
| Transcripts with timestamps | YouTube caption tracks (creator captions first, then auto captions) | No |
| Transcripts for videos without captions, visual analysis | Gemini video understanding | `GEMINI_API_KEY` (optional) |
| Thumbnail reading | Workers AI `llava-1.5-7b`, or Gemini | No (Workers AI is free) |
| Per-video and channel analysis | Workers AI Llama 3.1 8B / 3.3 70B, or Claude / OpenAI when configured | No |
| Instagram | Captions the creator pastes during onboarding | No |

### What the creator can see

- **Dashboard:** median views, upload rhythm, link clicks, lesson progress, a views-per-upload chart, what we learned, recent content compared with the median
- **Library:** every studied video or post, with its full searchable transcript (timestamps link into the video), hook and its strength, structure timeline, thumbnail reading, title pattern, topics, phrases, calls to action, products, what worked and what to improve
- **Brain:** the knowledge graph of videos, topics, strengths, gaps, style and audience, with confidence levels
- **Studio, Copilot, Quick tools:** drafting grounded in the Creator DNA
- **Lessons and Assessments:** planned from the creator's own gaps
- **Link in bio, Short links, Amazon:** a public page at `/@handle`, tracked redirects, product cards and earnings import

## Project structure

```
src/
  client/                 React SPA
    App.tsx               routes, app shell, navigation
    components/ui.tsx     design system primitives (Meter, PageHeader, Stat, ...)
    pages/                one file per screen
    lib/api.ts            typed API client
    lib/router.ts         small history-based router
  worker/                 Cloudflare Worker
    index.ts              app, middleware order, /s and /@ routes, cron
    middleware.ts         auth, CSRF origin check, rate limit, security headers
    env.ts                bindings and typed context
    routes/               one Hono router per area
    content/youtube.ts    feed, Data API, captions, transcript parsing
    content/analyze.ts    per-video deep study
    agents/definitions/   study pipeline, studio and research agents
    amazon/               SigV4 PA-API client, AES-GCM credential vault
    ai/                   provider router: Claude, OpenAI, Gemini, Workers AI
  shared/types.ts         types and zod schemas shared by client and worker
migrations/               D1 schema, applied with wrangler
tests/                    unit tests; tests/e2e has API tests against a local Worker
```

## Security

- **Passwords:** PBKDF2-SHA256 with a per-user random salt. The iteration count is stored with each hash so it can change later. Comparison is constant-time.
- **Sessions:** 256-bit random tokens in `HttpOnly; Secure; SameSite=Lax` cookies, deleted from D1 on logout.
- **Amazon credentials are per creator and encrypted.** The tracking ID, access key and secret key are each sealed with AES-GCM-256, under a key derived (HKDF) from the `ENCRYPTION_KEY` Worker secret. Every value gets a fresh IV, and the creator id is bound as additional authenticated data, so a ciphertext moved to another row fails to decrypt. Keys never reach the browser; only a `••••ABCD` hint does. Production refuses to start encryption without the secret.
- **CSRF:** writes whose `Origin` differs from the app's origin are rejected, on top of SameSite cookies. No CORS headers are sent, because the SPA and API share an origin.
- **Rate limiting:** sign-in and sign-up are limited to 10 attempts per IP per minute through the Workers Rate Limiting binding.
- **Input validation:** zod schemas on every write. Product imports and link building accept only Amazon URLs, and short links block private-network targets.
- **Output escaping:** the server-rendered public page escapes every creator-controlled field and allows only `http(s)` URLs.
- **Headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store` on API responses.
- **Data minimization:** password material is stripped at the data layer, and public lookups also drop the email.
- **The sample workspace is read-only**, enforced in middleware rather than in the UI.

## Efficiency

- Each request does one bounded piece of work, which keeps it inside the free tier's CPU and subrequest limits.
- Channel pages are streamed and only the first ~1.3 MB is read. Transcripts are condensed (the opening verbatim, then samples) before going to a model.
- The small Workers AI model handles per-video work; the larger one is used only for the channel-level synthesis.
- Short links resolve from KV first, and click analytics are written with `waitUntil` so redirects don't wait on them.
- One session lookup per request, in middleware. List endpoints read summary columns with `json_extract`, never whole transcripts.
- The client bundle is about 115 kB gzipped, with no UI framework beyond React.

## Accessibility

- Semantic landmarks, a skip link, one `h1` per page, labelled form controls, and errors announced with `role="alert"`.
- Everything works by keyboard, with a visible focus ring; dialogs trap focus and close on Escape.
- Text contrast meets WCAG AA. State is never shown by color alone; status uses icons or text too.
- `prefers-reduced-motion` turns off entrance animations. Charts have text alternatives.

## Testing

```bash
npm test            # unit tests: crypto, SigV4, transcript parsing, analysis schema, feed parsing, AI fallback
npm run test:e2e    # API tests against a real local Worker + D1
npm run typecheck
```

The end-to-end suite starts the Worker with Miniflare and a fresh local D1, then checks: signup validation, password and session handling, 401 on protected routes, the rate limit, cross-site write blocking, security headers, the read-only sample workspace, onboarding validation, encrypted Amazon credentials (keys never echoed, links tagged with the creator's own ID), isolation between creators, and HTML escaping on public pages.

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars          # set ENCRYPTION_KEY (openssl rand -base64 48); API keys are optional
npm run db:migrate:local
npm run build && npx wrangler dev       # http://localhost:8787
```

## Deploy (Cloudflare free tier)

```bash
npx wrangler login
npx wrangler d1 create creatorbrain-db           # put the id in wrangler.jsonc
npx wrangler kv namespace create KV              # put the id in wrangler.jsonc
npx wrangler secret put ENCRYPTION_KEY           # required
npx wrangler secret put GEMINI_API_KEY           # optional
npx wrangler secret put YOUTUBE_API_KEY          # optional
npm run db:migrate:remote
npm run deploy
```

## Assumptions

- **Public content only.** The study reads what YouTube already serves publicly: the uploads feed, caption tracks, thumbnails. It needs no OAuth and never posts for the creator.
- **Instagram:** there is no public Instagram API without app review and a business account, so Instagram is studied from captions the creator pastes during onboarding.
- **Videos without captions** are studied from title, description, thumbnail and stats, unless `GEMINI_API_KEY` is set, in which case Gemini transcribes them.
- **Each study run** deep-studies the 12 most recent waiting videos, so onboarding stays around two minutes. Older videos are studied by the daily job or from the Library.
- **Amazon:** live product data needs the creator's own PA-API 5.0 keys. Without them, product search shows a sample catalog that is labelled as such everywhere.
- **AI quality** depends on the configured provider. The free Workers AI models are good enough for structured breakdowns, and Gemini or Claude give richer analysis.
- **Earnings:** Amazon has no public earnings API, so earnings are imported from the Associates Central CSV export.

## Credits

The interface design pass used [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.
