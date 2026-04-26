# ThreatTriage: Phishing Email Analyzer — Design Spec

## Overview

ThreatTriage is a single-user phishing email analyzer built on Cloudflare's stack. Users paste suspicious email text (or dictate via voice), and the app analyzes it for phishing indicators, checks against past triages, and returns a verdict with reasoning. Past triages are stored for history browsing and semantic search ("have I seen this sender before?").

## Architecture

```
User → Pages (static HTML/JS) → Worker API → Workers AI (Llama 3.3)
                                     ↓
                              D1 (triage log)
                              Vectorize (email embeddings)
```

### Components

- **Frontend:** Single `index.html` hosted on Cloudflare Pages. Tailwind CSS via CDN. Vanilla JS, no build step.
- **Worker:** One Cloudflare Worker with three API routes (see API section).
- **D1:** SQLite database for structured triage logs.
- **Vectorize:** Vector index for semantic search over past email content.
- **Workers AI:** Llama 3.3 70B (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) for verdict generation. BGE Base EN v1.5 (`@cf/baai/bge-base-en-v1.5`) for embeddings.

### Deployment

All resources managed via Wrangler CLI. Single `wrangler.toml` configures the Worker with D1, Vectorize, and AI bindings.

## API Routes

### `POST /api/analyze`

**Request:** `{ "emailText": string }`

**Flow:**
1. Extract sender domain via regex from email headers/body
2. Query D1 for prior triages from this sender domain (count + past verdicts)
3. Generate embedding of email text via BGE model, query Vectorize for top 3 similar past triages
4. Build prompt for Llama 3.3 including: raw email text, prior sender history, similar past emails
5. LLM returns verdict (Safe / Suspicious / Phishing) + reasoning paragraph
6. Write to D1: email text, sender domain, verdict, reasoning, timestamp
7. Upsert embedding to Vectorize with D1 row ID as metadata

**Response:** `{ "id": number, "verdict": string, "reasoning": string, "senderDomain": string | null, "priorHistory": array, "similarEmails": array }`

### `GET /api/history`

**Request:** No body. Optional query param `?limit=N` (default 50).

**Response:** `[ { "id": number, "emailText": string, "senderDomain": string | null, "verdict": string, "reasoning": string, "createdAt": string } ]`

Ordered by `created_at DESC`.

### `POST /api/similar`

**Request:** `{ "emailText": string }`

**Flow:** Generate embedding, query Vectorize for top 5 similar past triages, join back to D1 for full records.

**Response:** `[ { "id": number, "senderDomain": string, "verdict": string, "reasoning": string, "createdAt": string, "score": number } ]`

## Data Model

### D1 Table: `triages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `email_text` | TEXT NOT NULL | Raw pasted email content |
| `sender_domain` | TEXT | Extracted domain (nullable if not found) |
| `verdict` | TEXT NOT NULL | "Safe", "Suspicious", or "Phishing" |
| `reasoning` | TEXT NOT NULL | LLM's explanation paragraph |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

### Vectorize Index: `triage-embeddings`

- **Dimensions:** 768 (bge-base-en-v1.5 output size)
- **Distance metric:** cosine
- **Metadata per vector:** `{ triage_id: number, sender_domain: string, verdict: string }`

## Frontend

Single `index.html` with Tailwind CSS (CDN), dark theme, vanilla JS.

### Analyze View (default)

- Large textarea for pasting email text
- Mic button (top-right corner of textarea) for voice input via Web Speech API — fills textarea with transcript
- "Analyze" submit button
- Results panel (appears after submission):
  - Verdict badge: color-coded (green = Safe, yellow = Suspicious, red = Phishing)
  - Reasoning paragraph
  - "Similar past emails" section (if any found)

### History View

- Tab-based navigation between Analyze and History
- List of past triages: sender domain, verdict badge, first ~100 chars of email text, timestamp
- Click a row to expand and see full reasoning

### Voice Input

- Uses `webkitSpeechRecognition` / `SpeechRecognition` browser API
- Speech-to-text only: fills textarea, user clicks "Analyze" to submit
- Mic button hidden if API is not available in the browser

## Error Handling

- **No sender domain found:** Store `null`, run analysis without prior-sender context
- **Empty/short input:** Frontend validates minimum 10 characters before submitting
- **Workers AI timeout/error:** Return clear error message to user, do not write to D1
- **Vectorize empty (first use):** Skip similar-emails step, run analysis without that context
- **Web Speech API unsupported:** Hide mic button gracefully

## Scope Boundaries

**In scope:**
- Single-user, no authentication
- Paste or voice-to-text email input
- LLM-powered phishing verdict with reasoning
- Triage history stored in D1
- Semantic search over past triages via Vectorize
- Wrangler-managed deployment

**Out of scope:**
- Multi-user / auth
- Real-time email ingestion (IMAP, webhooks)
- Actual domain reputation lookups (DNS, WHOIS)
- Email attachment analysis
- Notification/alerting
