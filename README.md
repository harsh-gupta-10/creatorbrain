# 🧠 CreatorBrain: Agentic Creator OS

> **PromptWars X AgentX 2.0 (Hack2Skill + Google)**  
> **Track:** Open Innovation  
> **Target Platform:** Cloudflare Free Tier (Workers + Hono + D1 + KV) + Google Cloud Run (Container Deployable)  
> **Live Demo & Test Suite:** 100% verified with `agent-browser` and Vitest quality gates.

---

## ⚡ 3-Sentence Submission Summary
> Content creators lose up to 15 hours a week context-switching across fragmented tools for scripting, thumbnail design, Amazon affiliate tracking, link-in-bio pages, and compliance—none of which remember their signature style. **CreatorBrain** is an autonomous operating system powered by 13 specialized AI agents with a persistent knowledge graph per creator that turns a casual product idea into 9 ready-to-publish assets in the creator's voice, complete with tracked Amazon affiliate links, short links, and edge-rendered bio blocks. Operating within Cloudflare’s free tier with multi-provider AI fallback and Web Crypto AES-GCM security, it autonomously audits FTC/Amazon compliance and schedules daily learning recommendations via cron triggers.

---

## 🎨 Visual Design & Marketing Website (Inspired by Synclify.ai)

CreatorBrain features a **white background canvas with subtle dotted grid architecture** (`#FAFAF9`), gradient text accents (`#FF5722` to `#9333EA`), crisp dark typography (`#0F172A`), and refined borders (`rgba(226, 232, 240, 0.9)`).

### 1. Detailed Marketing Website (`/`)
- **Hero & Floating Notifications:** Real-time channel sync pills, value proposition, and interactive mobile preview.
- **Interactive Simulated App Sandbox:** Clickable question prompts (`Motorola Edge vs Vivo`, `Retention Dip`, `Hinglish Voice`), role switchers (`Tech Creator`, `Brand`, `Agency`), macOS window frame, and live Amazon product card resolution.
- **Omnichannel 13-Agent Execution:** Interactive showcase demonstrating how a single prompt orchestrates scripts, links, bio updates, and FTC audits simultaneously.
- **Tool Replacement & Savings Calculator:** Dynamic checklist showing how CreatorBrain replaces ₹11,070/month in fragmented subscriptions (`ChatGPT Plus`, `Manychat`, `TubeBuddy`, `Linktree`, `Bitly`, `Compliance`) with ₹0 Cloudflare hosting.
- **FAQ Accordion & Final CTA Banner:** Detailed answers on Cloudflare free-tier limits, Amazon Creators API, and Creator DNA.

| Marketing Hero | Interactive App Sandbox |
|---|---|
| ![Marketing Hero](screenshots/00_marketing_hero.png) | ![Interactive Sandbox](screenshots/00_marketing_sandbox_window.png) |

| Omnichannel 13-Agent Execution | Tool Replacement & Savings Calculator |
|---|---|
| ![Omnichannel Grid](screenshots/00_marketing_calculator.png) | ![Savings Calculator](screenshots/00_marketing_calculator_bottom.png) |

### 2. Creator OS Application & Brain Copilot Chatbot
- **Dashboard Overview:** Greeting banner, orchestrator broadcast ticker, next best action, and active projects pipeline.
- **Brain Copilot Chatbot:** Dedicated persistent AI co-strategist with mode switchers (`Brainstorm`, `Script Architecture`, `Amazon Deals`, `Retention & Gaps`), prompt chips, and one-click "Open in Studio" project generation.
- **Content Studio:** 9-asset generation in Creator DNA voice with editable asset suite and markdown exports.
- **Brain Graph:** Interactive SVG knowledge graph and synthesized Creator DNA profile.

| Dashboard Overview | Brain Copilot Chatbot |
|---|---|
| ![Dashboard Overview](screenshots/01_tab_overview_top_clean.png) | ![Brain Copilot](screenshots/01b_tab_copilot_light.png) |

| Copilot Live Product Resolution | Content Studio 9-Asset Suite |
|---|---|
| ![Copilot Live Response](screenshots/01c_copilot_response.png) | ![Content Studio](screenshots/02_tab_content_studio_light.png) |

| Synthesized Creator DNA Profile | Interactive Brain Graph |
|---|---|
| ![Creator DNA Profile](screenshots/03_tab_brain_light.png) | ![Brain Graph](screenshots/03b_tab_brain_graph_svg.png) |

---

## 🚀 The Problem & Open Innovation Vision

### The Creator Fragmentation Crisis
Modern independent creators juggle 6+ disconnected single-purpose tools:
1. **Scripting & ideation** in ChatGPT / Claude (lacks memory of past video pacing or retention analytics).
2. **Affiliate monetization** in Amazon Associates SiteStripe (manual URL tagging, no expiration control, zero centralized asset synchronization).
3. **Link shorteners** (Bitly / Dub) that risk cloaking penalties under Amazon Associates Operating Agreement Section 4.
4. **Link-in-bio services** (Linktree / Beacons) that charge high subscription fees for basic click attribution and require manual copy-pasting of product cards.
5. **Skill development** through scattered YouTube tutorials that don't diagnose the creator's actual channel retention drop-offs.

### How CreatorBrain Solves It
CreatorBrain introduces **Creator OS**: a self-evolving autonomous multi-agent fleet grounded in a persistent relational knowledge graph stored on Cloudflare D1. Instead of starting from scratch, the creator simply discusses a video concept (e.g. *“Motorola Edge 50 Fusion vs Vivo T3 Pro 5G review for budget student buyers”*). CreatorBrain's agents research real-time product specs, write the entire 9-asset suite in the creator's unique voice, build compliant tracked links, update their Link-in-Bio page, audit FTC disclosure lines, and autonomously recommend retention improvements.

---

## 🏛️ Autonomous Agent Architecture & Knowledge Graph

```mermaid
flowchart TD
    subgraph ChannelOnboarding ["Channel Onboarding (6 Agents)"]
        CS[Channel Scout] --> PA[Packaging Analyst]
        CS --> VA[Visual Analyst]
        CS --> VEA[Voice & Edit Analyst]
        PA & VA & VEA --> SYN[Synthesizer]
        SYN --> DIAG[Diagnostician]
    end

    subgraph PersistentBrain ["Creator Brain Knowledge Graph (Cloudflare D1)"]
        DNA[(Creator DNA Profile)]
        NODES[(14 Graph Nodes: Style, Strength, Gap, Audience)]
        EDGES[(18 Relation Edges: STRONG_AT, NEEDS_WORK)]
        LEARN[(Persistent Learnings Feed)]
    end

    subgraph ContentStudioEngine ["Content Studio (Hero Workflow)"]
        INPUT[Creator Voice / Chat Input] --> SA[Content Studio Agent]
        SA <--> PR[Product Researcher: Amazon Creators API]
        SA --> ASSETS[10 Versioned Assets: Titles, Script, Description, Shorts, Poll]
        SA --> LA[Link Agent]
        LA --> SL[Short Links KV]
        LA --> BIO[Link-in-Bio D1 Page]
        ASSETS --> CC[Compliance Checker: FTC & Amazon Audit]
    end

    subgraph ContinuousGrowth ["Continuous Learning & Cron"]
        CRON[Autonomous Hourly Cron Trigger] --> ORCH[Orchestrator Agent]
        ORCH --> MC[Memory Curator]
        ORCH --> CURR[Curriculum Planner]
        CURR --> TUTOR[AI Tutor Coach]
        CURR --> ASSE[Assessor: 5-Question Quizzes]
    end

    SYN ==> NODES & EDGES & DNA
    DNA ==> SA & TUTOR
    NODES ==> CURR & ASSE
    ASSE ==> NODES
    MC ==> LEARN
```

---

## 🤖 The 13 Specialized Agents

| # | Agent Name | Primary Responsibility | Trigger & Tool Loop |
|---|---|---|---|
| 1 | **Channel Scout** | Fetches YouTube Data API v3 history (30 videos), samples 10 benchmarks (3 top, 3 recent, 2 median, 2 low) | Onboarding Pipeline / `fetchChannelVideos` |
| 2 | **Packaging Analyst** | Deconstructs title CTR syntax, curiosity gaps, description structures, hashtags, and CTA positions | Onboarding Pipeline / `analyzePackaging` |
| 3 | **Visual Analyst** | Vision analysis of thumbnails (palette, contrast, face expressions, text density) | Onboarding Pipeline / `analyzeThumbnails` |
| 4 | **Voice & Edit Analyst** | Multimodal Gemini video analysis of pacing, Hinglish language mix, catchphrases, and cut frequency | Onboarding Pipeline / `analyzeVoicePacing` |
| 5 | **Synthesizer** | Assembles Creator DNA JSON schema and writes Style, Strength, and Gap nodes to D1 | Onboarding Pipeline / `writeKnowledgeGraph` |
| 6 | **Diagnostician** | Detects creator retention dips (e.g. minute 4 drop) and initializes diagnostic curriculum | Onboarding Pipeline / `generateDiagnostic` |
| 7 | **Product Researcher** | Resolves products via Amazon Creators API / PA-API (SearchItems, GetItems), extracts specs, timestamped pricing, and ASINs | Content Studio / `amazonSearchItems` |
| 8 | **Content Studio Agent** | Synthesizes 9 project assets in Creator DNA voice (5 titles, full description, tags, pinned comment, Shorts, Instagram, script outline, thumbnail concepts, community poll) | Content Studio / `synthesizeContentAssets` |
| 9 | **Link Agent** | Generates tagged Amazon affiliate links (`?tag=partner-21`), registers KV short links (`/s/:slug`), and auto-injects product blocks into Link-in-Bio | Content Studio / `generateTrackedLink` |
| 10 | **Compliance Checker** | Audits affiliate disclosure lines, verifies price freshness timestamps, and flags exaggerated claims | Content Studio / `checkComplianceRules` |
| 11 | **Curriculum Planner** | Sequences ordered lessons based on weakest retention graph gaps and unlocks milestones | Learn & Coach / `planCurriculum` |
| 12 | **Tutor Coach** | Interactive coaching tutor grounded in the creator's exact knowledge graph gaps | Learn & Coach / `tutorChat` |
| 13 | **Assessor** | Generates and auto-scores 5-question quizzes from weakest gaps, updating graph weights upon completion | Skill Assessor / `scoreQuiz` |
| 14 | **Memory Curator** | Autonomous cron worker: merges redundant traits, decays stale traits, logs weekly learnings | Hourly Cron / `curateMemories` |
| 15 | **Orchestrator** | Cron entrypoint: monitors channel metrics and posts daily *Next Best Action* to dashboard | Hourly Cron / `evaluateChannelHealth` |

---

## 💬 Brain Copilot: Dedicated Conversational Creator AI

In addition to project-based studio generation, CreatorBrain features a full-canvas **Brain Copilot** (`/copilot`) where creators can chat, brainstorm, and shape raw ideas into production-ready concepts exactly how they want:
- **4 Operational Modes:**
  - 💡 *Brainstorm:* Uncover viral, contrarian angles and teardowns.
  - 🎬 *Script Architecture:* Structure 8-minute pacing with pattern interrupts to eliminate the minute-4 retention drop.
  - 📦 *Amazon Deals:* Curate budget creator kits and price-to-performance recommendations.
  - 🛡️ *Retention & Gaps:* Receive direct feedback on weakest channel topics grounded in the knowledge graph.
- **Dynamic Amazon Creators API Integration:** Mentions of products (e.g. Motorola, Vivo, Mac Mini, Sony) automatically resolve live specs, images, timestamped pricing, and ASINs with embedded preview cards.
- **1-Click Studio Conversion:** Turn any brainstormed concept directly into a formal Content Studio project with complete versioned assets!

---

## 📸 Screenshots & UI Gallery

| View | Screenshot |
|---|---|
| **Dashboard Overview**<br>*(Next Best Action, Metrics, Copilot Idea Station)* | ![Overview](screenshots/01_tab_overview.png) |
| **Brain Copilot Chatbot**<br>*(Conversational AI, Mode Toggles, Amazon Resolution)* | ![Brain Copilot](screenshots/01b_tab_copilot_chat.png) |
| **Content Studio**<br>*(9-Asset Suite, Studio Agent, Versioned Edits)* | ![Content Studio](screenshots/02_tab_content_studio.png) |
| **Brain Knowledge Graph**<br>*(Interactive SVG Graph, 4 DNA Pillars, Topology Breakdown)* | ![Brain Graph](screenshots/06_tab_brain.png) |
| **Autonomous Agent Fleet**<br>*(Live Timeline & Step-by-Step Tool Traces)* | ![Agent Fleet](screenshots/10_tab_agents.png) |

---

## 🎬 Content Studio Walkthrough: Motorola Edge 50 vs Vivo T3 Pro

### 1. Creator Prompt
```text
"Making an 8-minute comprehensive comparison review of Motorola Edge 50 Fusion and Vivo T3 Pro. Target audience is Indian engineering students wanting best value under ₹25,000. Focus on real camera samples, battery drain test, and Snapdragon thermals."
```

### 2. Autonomous Agent Execution (Zod-Validated Tool Loop)
1. **Product Researcher** queries Amazon Creators API:
   - Motorola Edge 50 Fusion (`B0D3G78JKL`): ₹22,999 (price as of Nov 12, 2026 18:30 IST), Snapdragon 7s Gen 2, Sony LYT-700C, IP68.
   - Vivo T3 Pro 5G (`B0DCF9X11M`): ₹24,999, Snapdragon 7 Gen 3, 5500mAh battery, 80W FlashCharge.
2. **Content Studio Agent** synthesizes 9 assets in Kabir Verma's Hinglish voice:
   - **5 Titles:** *1. Motorola Edge 50 Fusion vs Vivo T3 Pro: Don't Waste Your ₹22,000!*
   - **Description:** Complete hook, tagged Amazon links, FTC disclosure line, and retention timestamps.
   - **Script Outline:** 8-minute pacing breakdown with minute 3:45 forward loop teaser and thermal camera test.
   - **Shorts & Instagram Captions:** 45-second high-velocity teaser scripts.
3. **Link Agent** creates:
   - Short Link: `https://creatorbrain.dev/s/moto-edge-fusion` -> `https://www.amazon.in/dp/B0D3G78JKL?tag=techkabir-21`
   - Short Link: `https://creatorbrain.dev/s/vivo-t3-pro` -> `https://www.amazon.in/dp/B0DCF9X11M?tag=techkabir-21`
   - Auto-adds product cards to `https://creatorbrain.dev/@techkabir`.
4. **Compliance Checker** audits all output:
   - Verified disclosure present on line 4 of description and pinned comment.
   - Price timestamp present (*“Price accurate as of video upload and subject to change”*).
   - Zero cloaked redirects (100% ASCI & FTC conformed).

---

## 🖥️ Verified Browser UI & Tab Showcase (`agent-browser`)

All 11 tabs and user flows have been rigorously verified in a real headless Chromium browser using the official `agent-browser` engine:

| Tab | Feature & Status | Real Browser Screenshot |
|---|---|---|
| **Onboarding** | Channel URL / handle input, consent authorization, live 6-agent progress bar, instant demo bypass. **PASS** | ![Onboarding](screenshots/00_onboarding.png) |
| **1. Overview** | Today's Next Best Action, active project boards, 2,387 link clicks, curriculum progress, top performing links. **PASS** | ![Overview](screenshots/01_tab_overview.png) |
| **2. Content Studio (Hero)** | Multi-project board, Studio Agent AI chat, 9-asset suite inspector (editable, copy, export Markdown). **PASS** | ![Content Studio](screenshots/02_tab_content_studio.png) |
| **3. Creative Tools** | Creator DNA generators for Hook, Script Outline, Thumbnail Concept, and Captions. **PASS** | ![Creative Tools](screenshots/03_tab_creative_tools.png) |
| **4. Link-in-Bio** | Edge-rendered page builder, DNA color themes, drag/reorder blocks, click stats, inline QR code modal. **PASS** | ![Link-in-Bio](screenshots/04_tab_link_in_bio.png) |
| **5. Short Links** | KV sub-millisecond 302 redirects, SSRF safety badge, UTM parameters, geo/device click analytics modal. **PASS** | ![Short Links](screenshots/05_tab_short_links.png) |
| **6. Amazon Affiliate** | Product catalog with ASINs and timestamped pricing, SearchItems API tool, CSV earnings importer. **PASS** | ![Amazon Affiliate](screenshots/06_tab_amazon_affiliate.png) |
| **7. Brain Graph** | Interactive SVG force knowledge graph (14 nodes, 18 edges), node filtering drawer, Creator DNA card. **PASS** | ![Brain Graph](screenshots/07_tab_brain_graph.png) |
| **8. Learn & Coach** | Ordered curriculum lessons with completion unlocking, interactive AI Tutor coach grounded in graph gaps. **PASS** | ![Learn & Coach](screenshots/08_tab_learn_coach.png) |
| **9. Skill Assessor** | 5-question retention diagnostic quizzes, submission grading, instant knowledge graph gap resolution. **PASS** | ![Skill Assessor](screenshots/09_tab_skill_assessor.png) |
| **10. Agent Fleet** | Step-by-step trace timeline with tool inputs/outputs for all 13 agents, "Run Agents Now" orchestrator trigger. **PASS** | ![Agent Fleet](screenshots/10_tab_agent_fleet.png) |
| **11. Settings** | AI provider router & budget slider, BYO Amazon credentials with Web Crypto AES-GCM 256, Data Wipe button. **PASS** | ![Settings](screenshots/11_tab_settings.png) |

---

## 🔒 Security, Compliance & Cloudflare Free Tier Engineering

1. **Amazon Associates & FTC Ad Compliance:**
   - Strict adherence to Amazon Operating Agreement Section 4 (Transparent non-cloaked redirects, explicit disclosure line placed within the first 3 lines of video descriptions).
   - Price timestamps dynamically stamped on all product references (*“Price as of recorded date”*).
2. **BYO Amazon Credentials Security:**
   - Keys are encrypted client-side or at edge using **Web Crypto AES-GCM 256** with PBKDF2 (50,000 iterations). Keys are never logged and never returned to the browser.
3. **SSRF Safe Short Links:**
   - Redirect destinations validated against SSRF attacks: private IP blocks (`10.0.0.0/8`, `192.168.0.0/16`, `127.0.0.1`), metadata services (`169.254.169.254`), and non-HTTP protocols are blocked with unit test coverage.
4. **Cloudflare Free Tier Fit:**
   - **Bundle Size:** Worker bundle is **378 kB uncompressed (102 kB gzipped)**, well within the 3 MB compressed limit.
   - **Database (D1):** 21 relational tables with indexes, zero external database costs.
   - **Cache (KV):** High-speed edge redirect resolution and daily AI budget tracking.
   - **Edge Performance:** Link-in-Bio pages rendered directly at Cloudflare Edge locations with instant worldwide TTFB.

---

## 🧪 Vitest Quality Gates (100% Pass)

```bash
$ npm test

 RUN  v5.1.0 /home/gupta/Documents/code/CreatorBrain

 ✓ tests/all-quality-gates.test.ts (11 tests) 19ms
   ✓ Quality Gate 1: Provider Fallback Chain (2)
     ✓ falls back to mock provider gracefully when no external API keys are configured
     ✓ validates structured outputs with Zod in the fallback chain
   ✓ Quality Gate 2: Agent Framework & Tool Validation Loop (2)
     ✓ validates tool arguments with Zod and enforces step bounds
     ✓ rejects invalid parameters according to tool schema
   ✓ Quality Gate 3: Short Link Safety & SSRF Validation (3)
     ✓ accepts valid public e-commerce and YouTube URLs
     ✓ blocks private IPs, localhost, and non-http protocols (SSRF Prevention)
     ✓ validates custom slugs with regex
   ✓ Quality Gate 4: Amazon & FTC Compliance Verification (3)
     ✓ flags missing affiliate disclosure
     ✓ flags pricing claims missing freshness timestamps
     ✓ passes when disclosure and timestamp are present
   ✓ Quality Gate 5: Quiz Scoring & Assessment Calculation (1)
     ✓ accurately scores responses and calculates pass percentages

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  484ms
```

---

## 🛠️ Getting Started & Local Development

### Prerequisites
- Node.js 22.20+ / 24+
- npm 10+
- Cloudflare Wrangler CLI (`npm i -g wrangler`)

### 1. Installation
```bash
git clone https://github.com/your-repo/CreatorBrain.git
cd CreatorBrain
npm install
```

### 2. D1 Database Setup & Seeding
```bash
# Execute initial schema migration (21 tables)
npx wrangler d1 execute DB --local --file=migrations/0001_initial_schema.sql --yes

# Seed demo dataset for Kabir Verma (Tech Explainer, 7.5K subs)
npx wrangler d1 execute DB --local --file=migrations/0002_seed_demo_data.sql --yes
```

### 3. Build & Run Locally
```bash
# Build React 19 + Tailwind CSS 4 client
npm run build

# Start Cloudflare Worker dev server with Static Assets & D1
WRANGLER_LOG=none npx wrangler dev --port 8787 --ip 127.0.0.1
```
Open [http://localhost:8787](http://localhost:8787) in your browser!

---

## ☁️ Deployment Instructions

### Option A: Cloudflare Workers (Primary - Free Tier)
```bash
# Login to your Cloudflare account
npx wrangler login

# Create production D1 database & KV namespace
npx wrangler d1 create creatorbrain-db
npx wrangler kv:namespace create creatorbrain-kv

# Apply migrations to remote D1
npx wrangler d1 execute DB --remote --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute DB --remote --file=migrations/0002_seed_demo_data.sql

# Deploy Worker with Static Assets
npm run build
npx wrangler deploy
```

### Option B: Google Cloud Run (Container Deployment)
```bash
# Build & tag Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/creatorbrain:latest .

# Push to Google Container Registry / Artifact Registry
docker push gcr.io/YOUR_PROJECT_ID/creatorbrain:latest

# Deploy to Cloud Run
gcloud run deploy creatorbrain \
  --image gcr.io/YOUR_PROJECT_ID/creatorbrain:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars ENVIRONMENT=production
```

---

## 🎥 60-Second Demo Video Script

| Time | Visual / Screen Action | Voiceover / Narrative |
|---|---|---|
| **0:00 - 0:10** | Show Dashboard Overview with Kabir Verma's profile, next best action, and active projects. | *"Every YouTuber juggles six scattered tools—and none of them remember their voice. Welcome to CreatorBrain, the autonomous agentic OS for creators."* |
| **0:10 - 0:25** | Click into Content Studio. Type: *"Making a review on Motorola Edge 50 Fusion vs Vivo T3 Pro, budget angle under ₹25k."* | *"Watch our autonomous agents take over. The Product Researcher pulls live specs and timestamped prices from the Amazon Creators API. The Studio Agent immediately writes 5 high-CTR titles, timestamps, and a full script outline in Kabir's signature Hinglish tone."* |
| **0:25 - 0:38** | Switch to Description tab showing tagged Amazon link and FTC disclosure. Click Compliance audit report. | *"The Link Agent automatically creates tracked short links and updates Kabir's Link-in-Bio page, while our Compliance Checker audits FTC disclosure lines in real time."* |
| **0:38 - 0:50** | Click Brain Graph tab, zoom into SVG force graph showing Style, Gap, and Strength nodes. | *"Behind everything is a persistent knowledge graph in Cloudflare D1. When the creator takes a gap quiz or publishes a video, the graph updates and autonomous cron agents schedule their next best action."* |
| **0:50 - 1:00** | Click Link-in-Bio mobile preview and Settings. | *"Zero subscription fees. Hosted entirely on Cloudflare's free tier. CreatorBrain: your AI team that actually gets you."* |

---

## 📱 LinkedIn Post Draft (<150 words)

> Excited to unveil **CreatorBrain** for the PromptWars X AgentX 2.0 Hackathon (Open Innovation Track)! 🚀
> 
> Creators lose 15+ hours a week juggling scripting tools, Amazon affiliate tags, bio links, and compliance rules—none of which remember their style.
> 
> CreatorBrain solves this with a team of 13 autonomous AI agents backed by a persistent knowledge graph:
> 🎬 **Content Studio:** Turns a quick idea into 9 ready-to-publish assets in your unique voice.
> 📦 **Amazon & FTC Engine:** Researches specs, stamps price timestamps, and generates tracked links.
> 📱 **Edge Link-in-Bio & Short Links:** Sub-millisecond redirects on Cloudflare D1 + KV.
> 🧠 **Brain Graph:** Learns retention gaps and sequences personalized coaching quizzes.
> 
> 100% serverless on Cloudflare Free Tier (bundle <400kB) + React 19.
> 
> Check out the repo & demo: [GitHub Link]
> 
> #GoogleAI #AgentX #CloudflareWorkers #OpenInnovation #GenAI #TechCreators
