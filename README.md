<div align="center">

<img src="https://api.iconify.design/material-symbols:security-rounded.svg?color=%23f97316&width=80&height=80" alt="ThreatTriage Logo" />

# ThreatTriage

**AI-powered phishing email analyzer &mdash; built entirely on Cloudflare's edge**

[![Live Demo](https://img.shields.io/badge/live_demo-workers.dev-f97316?style=flat-square&logo=cloudflare)](https://threat-triage.suryanshsinghrawat.workers.dev)
[![Tests](https://img.shields.io/badge/tests-74%20passing-22c55e?style=flat-square&logo=vitest)](./test)
[![Workers AI](https://img.shields.io/badge/Workers_AI-LLaMA_3.3_70B-f97316?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/workers-ai/)
[![D1](https://img.shields.io/badge/D1-SQLite_at_edge-f97316?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/d1/)
[![Vectorize](https://img.shields.io/badge/Vectorize-semantic_search-f97316?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/vectorize/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

Paste a suspicious email. Get an instant AI verdict &mdash; **Safe**, **Suspicious**, or **Phishing** &mdash; with threat indicators, URL analysis, sender reputation, and semantic similarity. Zero servers. Zero cold starts.

[**Try the Live Demo &rarr;**](https://threat-triage.suryanshsinghrawat.workers.dev)

</div>

---

## Demo

<video src="https://github.com/user-attachments/assets/1566c03a-421f-4d78-a41e-11289f5a9056" width="100%" controls></video>

---

## How It Works

1. **Paste or drag-drop** a suspicious email (or `.eml` file)
2. **AI analyzes** the content using LLaMA 3.3 70B on Workers AI
3. **Get a verdict** with confidence score, threat indicators, flagged URLs, and similar past emails

Everything runs at the edge. No origin server, no containers, no cold starts.

---

## Built With Cloudflare

| Service | What it does |
|---|---|
| [**Workers**](https://developers.cloudflare.com/workers/) | Serverless edge runtime &mdash; handles all API routes and CORS |
| [**Workers AI**](https://developers.cloudflare.com/workers-ai/) | Runs **LLaMA 3.3 70B** for phishing verdicts and **BGE Base EN v1.5** for 768-dim email embeddings &mdash; entirely on Cloudflare's inference network |
| [**D1**](https://developers.cloudflare.com/d1/) | Edge SQLite database &mdash; stores triage history, sender domains, and analytics |
| [**Vectorize**](https://developers.cloudflare.com/vectorize/) | Vector index for cosine-similarity search across past email embeddings |
| [**Assets**](https://developers.cloudflare.com/workers/static-assets/) | Serves the single-page frontend from the edge |

---

## Features

- **Threat confidence gauge** &mdash; animated 0&ndash;100 ring with color-coded verdict badge
- **Structured indicators** &mdash; severity-ranked cards (critical &rarr; low) for each threat signal
- **URL pre-scanning** &mdash; flags typosquatting, IP hosts, `@` redirect tricks, excessive subdomains
- **Sender reputation** &mdash; surfaces prior verdicts from the same domain
- **Semantic similarity** &mdash; finds past emails with similar content via Vectorize
- **Dashboard** &mdash; aggregated stats, verdict distribution, top malicious senders
- **3-model fallback** &mdash; LLaMA 3.3 70B &rarr; 3.1 70B &rarr; 3.1 8B with truncated-JSON repair
- **Browser extension** &mdash; Chrome / Edge / Brave sidebar that auto-extracts from Gmail & Outlook

---

## Architecture

```
Browser / Extension
  │
  ▼
Cloudflare Workers
  │
  ├── POST /api/analyze     → domain extraction, URL scan, D1 history,
  │                           BGE embedding, Vectorize query, LLaMA verdict,
  │                           persist to D1 + Vectorize
  │
  ├── GET  /api/history     → paginated triage log
  ├── POST /api/similar     → semantic search
  └── GET  /api/stats       → aggregated analytics
```

---

## Quick Start

```bash
git clone https://github.com/xsuryanshx/cf-threat-triage.git
cd cf-threat-triage && npm install

# Create Cloudflare resources
npx wrangler d1 create threat-triage-db
npx wrangler d1 execute threat-triage-db --file=./schema.sql --remote
npx wrangler vectorize create triage-embeddings --dimensions=768 --metric=cosine

# Update wrangler.toml with your database_id, then:
npm run dev          # → http://localhost:8787
npx wrangler deploy  # → production
```

---

## Browser Extension

A sidebar panel injected via Shadow DOM &mdash; always accessible from a tab on the right edge of any page.

- Auto-extracts the open email from **Gmail** and **Outlook Web**
- Slides in/out with `Esc` or tab click
- Full threat gauge, verdict, and indicator cards
- `Cmd/Ctrl + Enter` to analyze

```bash
cd extension && npm install && node generate-icons.js
# chrome://extensions → Developer Mode → Load unpacked → extension/
```

---

## License

MIT
