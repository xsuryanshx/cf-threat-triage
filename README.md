<div align="center">

<img src="https://api.iconify.design/material-symbols:security-rounded.svg?color=%23f97316&width=80&height=80" alt="ThreatTriage Logo" />

# ThreatTriage

**AI-powered phishing email analyzer built entirely on Cloudflare's edge stack**

[![Tests](https://img.shields.io/badge/tests-74%20passing-22c55e?style=flat-square&logo=vitest)](./test)
[![Deploy](https://img.shields.io/badge/deployed-workers.dev-f97316?style=flat-square&logo=cloudflare)](https://threat-triage.suryanshsinghrawat.workers.dev)
[![Workers AI](https://img.shields.io/badge/Workers_AI-LLaMA_3.3_70B-f97316?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/workers-ai/)
[![D1](https://img.shields.io/badge/D1-SQLite_at_edge-f97316?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![Vectorize](https://img.shields.io/badge/Vectorize-semantic_search-f97316?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/vectorize/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[**Live Demo →**](https://threat-triage.suryanshsinghrawat.workers.dev)

</div>

---

## Demo

<video src="demo.mp4" width="100%" controls></video>

---

## Browser Extension

ThreatTriage also ships as a **Chrome / Edge / Brave extension** — a compact popup that lives in your toolbar.

### How it works

A **fixed sidebar panel** is injected into every page via Shadow DOM — completely isolated from the host page's styles. A tab sticks out from the right edge of the browser window at all times. Click it to slide the panel open; click again (or press `Esc`) to collapse it back.

```
  Page content          Tab    Panel (380px)
  ─────────────────── ┌─────┐ ┌──────────────────────┐
                      │  🛡  │ │ ThreatTriage ● Workers│
                      │      │ │──────────────────────│
  (normal page)       │Triage│ │ [email textarea]     │
                      │      │ │ [Analyze Threat]     │
                      │  ‹  │ │──────────────────────│
                      │      │ │ 95 ● PHISHING        │
                      └─────┘ │ 🔴 spoofed_domain    │
                              │ 🟠 urgency_language  │
                              └──────────────────────┘
```

### Features
- **Always-visible tab** on the right edge — never gets in the way
- **Slides in smoothly** with CSS transition, collapses on `Esc` or tab click
- **Auto-extracts** the open email from Gmail and Outlook Web — no copy-paste needed
- **Shadow DOM** — fully isolated, zero CSS conflicts with host page
- **Threat gauge** 0–100, verdict badge, indicator cards with severity
- `Cmd/Ctrl + Enter` to analyze

### Install (Development)

```bash
# 1. Build icons (one-time)
cd extension && npm install && node generate-icons.js

# 2. Load in Chrome / Edge / Brave
# → chrome://extensions → Enable Developer Mode
# → Load unpacked → select the extension/ folder
```

### Extension Structure

```
extension/
├── manifest.json      # MV3, all_urls content script, no popup
├── background.js      # Toolbar icon click → toggle sidebar message
├── content.js         # Injects Shadow DOM sidebar into every page
├── generate-icons.js  # Generates icons/16,48,128.png via canvas
└── icons/
    ├── 16.png
    ├── 48.png
    └── 128.png
```

---

## What is ThreatTriage?

ThreatTriage lets you paste (or drag-drop) a suspicious email and get back an instant AI verdict — **Safe**, **Suspicious**, or **Phishing** — along with:

- A **threat confidence score** (0–100 gauge)
- **Structured threat indicators** with severity levels (critical → low)
- **URL extraction** with automatic flag for typosquatting, IP hosts, and redirect tricks
- **Sender history** — has this domain been seen before? What was the verdict?
- **Semantic similarity** — have we seen an email like this before? (via Vectorize)
- A **dashboard** showing threat distribution and top malicious senders

Everything runs at the edge on Cloudflare Workers — no servers, no cold starts.

---

## Architecture

```
Browser
  │
  ▼
Cloudflare Workers (src/index.ts)
  │
  ├─── POST /api/analyze
  │       ├── extractSenderDomain()       ← regex domain extraction
  │       ├── extractUrls() + analyzeUrls()  ← URL threat pre-scan
  │       ├── D1: getTriagesByDomain()    ← prior sender history
  │       ├── Workers AI (BGE)            ← generate embedding
  │       ├── Vectorize: query()          ← semantic similar emails
  │       ├── Workers AI (LLaMA 3.3 70B)  ← AI verdict + indicators
  │       ├── D1: insertTriage()          ← persist result
  │       └── Vectorize: insert()         ← store embedding
  │
  ├─── GET  /api/history                  ← paginated triage log
  ├─── POST /api/similar                  ← standalone semantic search
  └─── GET  /api/stats                    ← aggregated threat analytics
```

**Cloudflare services used:**

| Service | Role |
|---|---|
| **Workers** | Serverless edge runtime |
| **Workers AI — LLaMA 3.3 70B** | Phishing verdict + threat indicators |
| **Workers AI — BGE Base EN v1.5** | 768-dim email embeddings |
| **D1 (SQLite)** | Persistent triage history + analytics |
| **Vectorize** | Semantic similarity search across past emails |
| **Assets** | Static frontend hosting |

---

## Features

### 🔍 Analyze
- Paste or **drag-drop a `.eml` file**
- Animated **scanning state** while AI processes
- **Circular threat gauge** showing confidence 0–100
- Color-coded verdict badge: 🟢 Safe / 🟡 Suspicious / 🔴 Phishing

### 🧩 Threat Indicators
Each analysis returns 2–6 structured indicators:
```json
[
  { "type": "spoofed_domain",    "detail": "paypa1-support.com imitates paypal.com", "severity": "critical" },
  { "type": "urgency_language",  "detail": "24-hour account suspension threat",       "severity": "high"     },
  { "type": "credential_request","detail": "Requests SSN, PIN, and account number",   "severity": "critical" }
]
```

### 🔗 URL Analysis
Pre-scans all URLs before sending to the LLM:
- IP address as hostname
- Typosquatting patterns (`paypa1`, `g00gle`, `micr0soft`, …)
- URLs containing `@` (redirect trick)
- Excessive subdomains
- Unusually long URLs

### 📊 Dashboard
- Total scanned / Safe / Suspicious / Phishing counts
- Animated verdict distribution bars
- Top sender domains ranked by phishing count

### 🕑 History
- Filterable by verdict (All / Phishing / Suspicious / Safe)
- Expandable cards showing full reasoning
- Confidence score per triage

### 🤖 AI Resilience
- **3-model fallback chain**: `llama-3.3-70b` → `llama-3.1-70b` → `llama-3.1-8b`
- **Truncated JSON repair**: closes unclosed brackets, strips trailing commas — handles LLMs that hit token limits mid-response
- Embedding and Vectorize failures are **non-fatal** — analysis continues without similarity context

---

## Project Structure

```
cf-threat-triage/
├── src/
│   ├── index.ts               # Worker entry — route dispatcher + CORS
│   ├── types.ts               # Env, Triage, ThreatIndicator, TriageStats
│   ├── routes/
│   │   ├── analyze.ts         # POST /api/analyze — full AI pipeline
│   │   ├── history.ts         # GET  /api/history — paginated log
│   │   ├── similar.ts         # POST /api/similar — semantic search
│   │   └── stats.ts           # GET  /api/stats   — aggregated analytics
│   └── lib/
│       ├── ai.ts              # Workers AI: embedding + verdict with fallback + JSON repair
│       ├── db.ts              # D1 typed query helpers + stats aggregation
│       ├── extract-domain.ts  # Sender domain extraction from email headers/body
│       └── extract-urls.ts    # URL extraction + suspicious pattern detection
├── test/
│   ├── e2e-flow.test.ts       # Full pipeline: analyze→D1→Vectorize→history→stats
│   ├── router.test.ts         # Route dispatch, methods, CORS
│   ├── ai-truncated.test.ts   # Truncated JSON repair edge cases
│   ├── ai-fallback.test.ts    # 3-model fallback chain
│   ├── stats.test.ts          # Stats aggregation
│   ├── analyze.test.ts        # Analyze route unit tests
│   ├── history.test.ts        # History route + limit clamping
│   ├── similar.test.ts        # Similar route + Vectorize mock
│   ├── db.test.ts             # D1 query helpers
│   ├── ai.test.ts             # AI helpers
│   ├── extract-domain.test.ts # Domain extraction
│   └── extract-urls.test.ts   # URL extraction + analysis
├── public/
│   └── index.html             # Single-page frontend (Tailwind CDN, vanilla JS)
├── schema.sql                 # D1 CREATE TABLE + indexes
└── wrangler.toml              # Worker config: D1, Vectorize, AI bindings
```

---

## API Reference

### `POST /api/analyze`

Analyze an email for phishing indicators.

**Request:**
```json
{ "emailText": "From: security@paypa1-support.com\n..." }
```

**Response:**
```json
{
  "id": 42,
  "verdict": "Phishing",
  "confidence": 95,
  "reasoning": "This email exhibits classic phishing patterns...",
  "indicators": [
    { "type": "spoofed_domain", "detail": "paypa1-support.com", "severity": "critical" }
  ],
  "senderDomain": "paypa1-support.com",
  "urls": [
    { "url": "http://paypa1-support.com/verify", "suspicious": true, "reason": "Possible typosquatting domain" }
  ],
  "priorHistory": [...],
  "similarEmails": [{ "score": 0.94, "verdict": "Phishing", ... }]
}
```

---

### `GET /api/history?limit=50`

Returns past triages, newest first. `limit` clamped to `[1, 200]`.

---

### `POST /api/similar`

Find semantically similar past emails via Vectorize.

**Request:**
```json
{ "emailText": "Your account has been suspended..." }
```

**Response:** Array of triages with `score` field (cosine similarity).

---

### `GET /api/stats`

Aggregated threat analytics.

```json
{
  "total": 142,
  "safe": 89,
  "suspicious": 31,
  "phishing": 22,
  "topDomains": [
    { "domain": "evil.com", "count": 8, "phishing_count": 7 }
  ],
  "recentActivity": [
    { "date": "2026-04-26", "count": 12 }
  ]
}
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `npm install -g wrangler`
- A Cloudflare account with Workers AI enabled

### 1. Clone & install

```bash
git clone https://github.com/xsuryanshx/cf-threat-triage.git
cd cf-threat-triage
npm install
```

### 2. Create Cloudflare resources

```bash
# D1 database
npx wrangler d1 create threat-triage-db
# → copy the database_id into wrangler.toml

# Apply schema
npx wrangler d1 execute threat-triage-db --file=./schema.sql --remote

# Vectorize index (768 dims to match BGE Base EN v1.5)
npx wrangler vectorize create triage-embeddings --dimensions=768 --metric=cosine
```

### 3. Configure `wrangler.toml`

```toml
[[d1_databases]]
binding = "DB"
database_name = "threat-triage-db"
database_id = "your-database-id-here"   # ← paste from step 2
```

### 4. Run tests

```bash
npm test
# 74 tests across 12 test files — all should pass
```

### 5. Local dev

```bash
npm run dev
# opens http://localhost:8787
# runs against real Cloudflare AI/D1/Vectorize (requires wrangler login)
```

### 6. Deploy

```bash
npx wrangler deploy
```

---

## Tests

**74 tests, 12 test files**, covering:

| Suite | Tests | Coverage |
|---|---|---|
| `e2e-flow` | 12 | Full pipeline: analyze → D1 → Vectorize → history → stats |
| `router` | 9 | All routes, wrong methods → 404, CORS preflight |
| `ai-fallback` | 5 | 3-model fallback, empty/null responses |
| `ai-truncated` | 5 | Truncated JSON repair, trailing commas, unclosed braces |
| `ai` | 7 | Embedding, verdict parsing, markdown fences, defaults |
| `stats` | 4 | Aggregated stats, empty DB, null rows, DB error |
| `analyze` | 5 | Validation, full success, AI failure → 500 |
| `history` | 4 | Default/custom limit, max clamp |
| `similar` | 3 | Missing body, matches, empty Vectorize |
| `db` | 6 | Insert, query by domain, get all, get by IDs |
| `extract-domain` | 7 | Headers, fallback, edge cases, lowercase |
| `extract-urls` | 7 | Extraction, dedup, caps, suspicious patterns |

```bash
npm test
```

---

## Security Notes

- **Prompt injection mitigation** — email content is enclosed in a per-request UUID boundary token in the LLM prompt, preventing injected instructions from being treated as system commands
- **Input validation** — minimum 10-character email text enforced at the API layer
- **D1 parameterization** — all queries use prepared statements with bound parameters
- **XSS prevention** — all user-derived content in the frontend uses DOM `textContent` assignment, never `innerHTML`
- **Limit clamping** — history `limit` param clamped to `[1, 200]` to prevent unbounded queries

---

## License

MIT
