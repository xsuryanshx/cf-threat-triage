# AI Prompts Used — ThreatTriage

This file documents the AI-assisted prompts used during the development of ThreatTriage, as required by the assignment guidelines. The project was built interactively using [pi](https://github.com/mariozechner/pi) coding agent powered by Claude.

---

## 1. Project Scaffolding & Initial Build

**Prompt:**
> Build a phishing email analyzer on Cloudflare Workers. Use Workers AI (LLaMA 3.3 70B) for the verdict, D1 for storing triage history, and Vectorize for semantic similarity search. Follow strict TDD — write failing tests first, then implement. Tech stack: TypeScript, Wrangler, Vitest.

**What it produced:**
- Full project scaffold (`wrangler.toml`, `tsconfig.json`, `vitest.config.ts`, `schema.sql`)
- Domain extraction utility with regex (`src/lib/extract-domain.ts`)
- D1 typed query helpers (`src/lib/db.ts`)
- Workers AI helpers for embedding + verdict (`src/lib/ai.ts`)
- Three API routes: `POST /api/analyze`, `GET /api/history`, `POST /api/similar`
- Single-page frontend with dark theme, analyze + history tabs, voice input
- 31 unit tests across 6 files

---

## 2. Deploying to Cloudflare

**Prompt:**
> `<REDACTED-DB-ID>` this is my db id — run the commands for triage agent

**What it produced:**
- Updated `wrangler.toml` with real D1 database ID
- Ran `wrangler d1 execute` to apply schema remotely
- Confirmed Vectorize index already existed
- Ran `wrangler deploy` → live at `https://threat-triage.suryanshsinghrawat.workers.dev`

---

## 3. Debugging 500 Errors (Local Dev)

**Prompt:**
> *(Pasted wrangler dev logs showing `POST /api/analyze 500 Internal Server Error`)*

**What it produced:**
- Diagnosed two issues: local D1 had no schema applied, Vectorize local bindings unsupported
- Applied schema to local D1: `wrangler d1 execute --file=./schema.sql`
- Added `--experimental-vectorize-bind-to-prod` flag to dev script
- Later switched to `--remote` flag after persistent auth errors

---

## 4. Major Feature Upgrade — "Make It More Impressive for Cloudflare"

**Prompt:**
> recheck now, the project doesn't look that good to me, is that what we can do best here for impressing cloudflare? the mic feature is bad

**What it produced:**

*Backend:*
- Richer AI analysis: LLM now returns `confidence` (0–100), structured `indicators` with severity levels (critical/high/medium/low)
- URL extraction + analysis (`src/lib/extract-urls.ts`) — flags IP hostnames, typosquatting, `@` tricks
- New `GET /api/stats` endpoint with aggregated threat analytics
- Updated D1 schema with `confidence` and `indicators` columns + indexes
- 3-model fallback chain: `llama-3.3-70b` → `llama-3.1-70b` → `llama-3.1-8b`

*Frontend redesign:*
- Replaced mic button with drag-and-drop `.eml` file upload
- Animated circular threat gauge (0–100)
- Color-coded indicator cards by severity
- Dashboard tab with stat cards and animated verdict distribution bars
- History tab with filter buttons (All / Phishing / Suspicious / Safe)
- Scanning animation while AI processes

---

## 5. Fixing Truncated JSON from LLM

**Prompt:**
> *(Pasted wrangler logs showing `Failed to parse JSON: Expected ',' or ']' after array element in JSON at position 1113`)*

**What it produced:**
- Diagnosed root cause: LLMs hitting `max_tokens` limit mid-response, cutting off JSON
- Added `max_tokens: 1024` to all AI calls
- Simplified prompt to reduce token usage
- Implemented `repairTruncatedJson()` function — closes unclosed brackets, strips trailing commas, handles incomplete array elements
- Added system message: "Respond with ONLY a valid JSON object. No markdown."

---

## 6. Writing Tests Before Deploying

**Prompt:**
> write tests before deploying anything, make test to see if the flows are working

**What it produced:**
- `test/e2e-flow.test.ts` — 12 end-to-end tests simulating full pipeline: analyze → D1 → Vectorize → history → stats
- `test/router.test.ts` — 9 tests covering all routes, wrong methods → 404, CORS preflight
- `test/ai-fallback.test.ts` — 5 tests for 3-model fallback chain
- `test/ai-truncated.test.ts` — 5 tests for truncated JSON repair edge cases
- `test/stats.test.ts` — 4 tests for aggregated stats endpoint
- `test/extract-urls.test.ts` — 7 tests for URL extraction and suspicious pattern detection
- Total: 74 tests across 12 files, all passing

---

## 7. Browser Extension — Concept

**Prompt:**
> can this be made as an extension as well? pitch like that in the readme also and implement the plan, it should be like a popup and then it should take the email and then tell us a score

**What it produced:**
- Chrome MV3 extension with `manifest.json`, `popup.html`, `popup.js`, `content.js`
- Content script to auto-extract emails from Gmail and Outlook Web
- Compact 400px popup with threat gauge, indicator cards, sender domain display
- Icon generation script using `node-canvas`
- README section with extension pitch and install instructions

---

## 8. Extension Redesign — Sidebar Instead of Popup

**Prompt:**
> it should not be a popup, it should come as a bubble on the right side of our window and we can click it and analyze the email it goes back if we dont use it. its like this *(screenshot of Jobright extension)* like the jobright extension on the right side we can use it if we click it and it stays

**What it produced:**
- Removed popup entirely
- `content.js` injects a full Shadow DOM sidebar into every page
- Fixed tab on right edge of viewport (orange shield with "TRIAGE" label)
- Panel slides in from the right with CSS transition (380px wide, full height)
- `Esc` or tab click collapses it back
- `background.js` service worker handles toolbar icon click → toggle message
- Auto-extracts email from Gmail/Outlook when panel opens

---

## 9. Fixing Extension Network Error (CORS)

**Prompt:**
> *(Pasted wrangler logs showing `InferenceUpstreamError: 10000: Authentication error` and "Network error — check your connection" in extension)*

**What it produced:**
- Diagnosed: content scripts blocked by Gmail's strict CSP when calling external APIs
- Fix 1: Proxied all API calls through `background.js` service worker (not subject to host page CSP)
- Fix 2: Added `Access-Control-Allow-Origin: *` to ALL API responses in `src/index.ts`, not just OPTIONS preflight — background service worker fetch was being CORS-blocked on actual responses
- Added `return true` in background message listener to keep async channel open
- Added direct fetch fallback if `sendMessage` fails

---

## 10. Fixing Extension Tab Positioning

**Prompt:**
> *(Screenshot showing the Triage tab floating in the middle of the Gmail page instead of sticking to the right edge)*

**What it produced:**
- Diagnosed: host element used `display: flex` with tab + panel as siblings — closed panel still occupied 380px of flex space, pushing tab 380px from right edge
- Fix: Changed host to `width: 0; overflow: visible` so children extend left without taking space
- Tab: changed to `position: absolute; right: 0` — always at right edge
- Panel: changed to `position: absolute; right: 0; transform: translateX(100%)` — off-screen when closed
- Tab gets `open` class on open → `right: 380px` (slides with panel)
- Appended host to `document.documentElement` instead of `document.body` to escape Gmail's CSS transform containing blocks

---

## 11. Documentation

**Prompt:**
> make a readme.md for this, should be interactive, also it should have a demo video for it

**What it produced:**
- Full README with badges, architecture diagram, features breakdown, API reference, setup guide, test coverage table, security notes
- `scripts/record-demo.md` with 90-second shot-by-shot recording script

**Follow-up prompt:**
> remove the video, we are okay with screenshot as well

**Follow-up prompt:**
> add the demo.mp4 as the path in readme so github can take that as preview

**What it produced:**
- `<video src="demo.mp4" width="100%" controls></video>` embed in README — GitHub renders this as an inline video player when `demo.mp4` is committed to the repo root

---

## Tools & Models Used

| Tool | Usage |
|---|---|
| **pi coding agent** | Primary development environment — reading files, editing code, running commands |
| **Claude (Anthropic)** | Underlying model powering all code generation, debugging, and reasoning |
| **Cloudflare Workers AI — LLaMA 3.3 70B** | Runtime AI model for phishing verdict generation |
| **Cloudflare Workers AI — BGE Base EN v1.5** | Email embedding generation for semantic search |

---

## Key AI-Assisted Decisions

1. **Prompt injection mitigation** — AI suggested using a per-request UUID boundary token in the LLM prompt to prevent email content from injecting instructions
2. **Non-fatal error handling** — AI designed embedding/Vectorize failures as non-fatal, allowing the analysis to proceed without similarity context
3. **Truncated JSON repair** — AI identified the LLM token limit issue from raw logs and designed the repair algorithm
4. **Shadow DOM isolation** — AI recommended Shadow DOM over plain DOM injection to prevent CSS conflicts with Gmail's stylesheets
5. **Background service worker proxy** — AI identified Gmail's CSP as the cause of network errors and designed the message-passing proxy pattern
