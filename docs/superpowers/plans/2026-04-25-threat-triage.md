# ThreatTriage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user phishing email analyzer on Cloudflare's stack that triages pasted email text with an LLM verdict and remembers past analyses.

**Architecture:** One Cloudflare Worker handles all API routes (`/api/analyze`, `/api/history`, `/api/similar`) and serves static assets from `public/`. Workers AI (Llama 3.3 + BGE) provides verdict generation and embeddings. D1 stores structured triage logs; Vectorize stores embeddings for semantic search.

**Tech Stack:** TypeScript, Cloudflare Workers, Workers AI, D1, Vectorize, Wrangler, Vitest, Tailwind CSS (CDN)

---

## File Structure

```
cf-threat-triage/
├── wrangler.toml               # Worker config: assets, D1, Vectorize, AI bindings
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── schema.sql                  # D1 CREATE TABLE
├── src/
│   ├── index.ts                # Worker entry: route dispatcher
│   ├── types.ts                # Env interface + shared Triage type
│   ├── routes/
│   │   ├── analyze.ts          # POST /api/analyze — full analysis flow
│   │   ├── history.ts          # GET /api/history — list past triages
│   │   └── similar.ts          # POST /api/similar — semantic search
│   └── lib/
│       ├── extract-domain.ts   # Regex domain extraction from email text
│       ├── ai.ts               # Workers AI: LLM verdict + BGE embeddings
│       └── db.ts               # D1 typed query helpers
├── public/
│   └── index.html              # Single-page frontend (Tailwind CDN, dark theme)
└── test/
    ├── extract-domain.test.ts
    ├── db.test.ts
    ├── ai.test.ts
    ├── analyze.test.ts
    ├── history.test.ts
    └── similar.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `wrangler.toml`
- Create: `schema.sql`
- Create: `src/types.ts`

- [ ] **Step 1: Initialize npm and install dependencies**

```bash
npm init -y
npm install -D wrangler@^3 typescript@^5 @cloudflare/workers-types@^4 vitest@^2
```

Expected output: `node_modules/` created, no errors.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "cf-threat-triage",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241224.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8",
    "wrangler": "^3.99.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write `wrangler.toml`** (use placeholder ID; real ID filled in Task 10)

```toml
name = "threat-triage"
main = "src/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./public"

[[d1_databases]]
binding = "DB"
database_name = "threat-triage-db"
database_id = "PLACEHOLDER"

[[vectorize]]
binding = "VECTORIZE"
index_name = "triage-embeddings"

[ai]
binding = "AI"
```

- [ ] **Step 6: Write `schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS triages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_text TEXT NOT NULL,
  sender_domain TEXT,
  verdict TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 7: Write `src/types.ts`**

```typescript
export interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

export interface Triage {
  id: number;
  email_text: string;
  sender_domain: string | null;
  verdict: 'Safe' | 'Suspicious' | 'Phishing';
  reasoning: string;
  created_at: string;
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: project scaffold — wrangler, tsconfig, vitest, schema, types"
```

---

## Task 2: Domain Extraction

**Files:**
- Create: `src/lib/extract-domain.ts`
- Create: `test/extract-domain.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/extract-domain.test.ts
import { describe, it, expect } from 'vitest';
import { extractSenderDomain } from '../src/lib/extract-domain';

describe('extractSenderDomain', () => {
  it('extracts domain from "From: Name <user@evil.example.com>" header', () => {
    const email = 'From: John Doe <john@evil.example.com>\nSubject: Test';
    expect(extractSenderDomain(email)).toBe('evil.example.com');
  });

  it('extracts domain from bare "From: user@phishing.net" header', () => {
    const email = 'From: attacker@phishing.net\nSubject: Urgent';
    expect(extractSenderDomain(email)).toBe('phishing.net');
  });

  it('falls back to first email address in body if no From header', () => {
    const email = 'Click here to verify: support@scam.io/verify';
    expect(extractSenderDomain(email)).toBe('scam.io');
  });

  it('returns null when no email address found', () => {
    const email = 'This is just plain text with no email addresses.';
    expect(extractSenderDomain(email)).toBeNull();
  });

  it('lowercases the domain', () => {
    const email = 'From: User@UPPER.COM';
    expect(extractSenderDomain(email)).toBe('upper.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/extract-domain.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/extract-domain'`

- [ ] **Step 3: Write `src/lib/extract-domain.ts`**

```typescript
/**
 * Extracts the sender's domain from raw email text.
 * Tries the From: header first, then falls back to any email address in the text.
 * Returns null if no email address is found.
 */
export function extractSenderDomain(emailText: string): string | null {
  // Match "From: Name <user@domain.com>" or "From: user@domain.com"
  const fromMatch = emailText.match(
    /^From:.*?[\s<]([a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/im
  );
  if (fromMatch) return fromMatch[2].toLowerCase();

  // Fallback: first email address anywhere in the text
  const emailMatch = emailText.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1].toLowerCase();

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/extract-domain.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extract-domain.ts test/extract-domain.test.ts
git commit -m "feat: domain extraction from email text with tests"
```

---

## Task 3: D1 DB Helpers

**Files:**
- Create: `src/lib/db.ts`
- Create: `test/db.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/db.test.ts
import { describe, it, expect, vi } from 'vitest';
import { insertTriage, getTriagesByDomain, getAllTriages, getTriagesByIds } from '../src/lib/db';
import type { Env } from '../src/types';

function makeMockStatement() {
  const stmt: any = {
    run: vi.fn().mockResolvedValue({ meta: { last_row_id: 42 } }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
  stmt.bind = vi.fn().mockReturnValue(stmt);
  return stmt;
}

function makeMockEnv(): Env {
  const stmt = makeMockStatement();
  return {
    DB: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    AI: {} as unknown as Ai,
    VECTORIZE: {} as unknown as VectorizeIndex,
  };
}

describe('insertTriage', () => {
  it('prepares INSERT and returns last_row_id', async () => {
    const env = makeMockEnv();
    const id = await insertTriage(env, {
      email_text: 'test email',
      sender_domain: 'evil.com',
      verdict: 'Phishing',
      reasoning: 'Suspicious link',
    });
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO triages')
    );
    expect(id).toBe(42);
  });
});

describe('getTriagesByDomain', () => {
  it('queries by sender_domain and returns results', async () => {
    const env = makeMockEnv();
    const results = await getTriagesByDomain(env, 'evil.com');
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('sender_domain = ?')
    );
    expect(results).toEqual([]);
  });
});

describe('getAllTriages', () => {
  it('passes default limit of 50', async () => {
    const env = makeMockEnv();
    await getAllTriages(env);
    const stmt = (env.DB.prepare as any).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(50);
  });

  it('respects custom limit', async () => {
    const env = makeMockEnv();
    await getAllTriages(env, 10);
    const stmt = (env.DB.prepare as any).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(10);
  });
});

describe('getTriagesByIds', () => {
  it('returns empty array immediately when ids is empty', async () => {
    const env = makeMockEnv();
    const results = await getTriagesByIds(env, []);
    expect(env.DB.prepare).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it('queries with IN clause for given ids', async () => {
    const env = makeMockEnv();
    await getTriagesByIds(env, [1, 2, 3]);
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('IN (?,?,?)')
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/db.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/db'`

- [ ] **Step 3: Write `src/lib/db.ts`**

```typescript
import type { Env, Triage } from '../types';

export async function insertTriage(
  env: Env,
  data: { email_text: string; sender_domain: string | null; verdict: string; reasoning: string }
): Promise<number> {
  const result = await env.DB.prepare(
    'INSERT INTO triages (email_text, sender_domain, verdict, reasoning, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(data.email_text, data.sender_domain, data.verdict, data.reasoning, new Date().toISOString())
    .run();
  return result.meta.last_row_id as number;
}

export async function getTriagesByDomain(env: Env, domain: string): Promise<Triage[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM triages WHERE sender_domain = ? ORDER BY created_at DESC LIMIT 5'
  )
    .bind(domain)
    .all<Triage>();
  return result.results;
}

export async function getAllTriages(env: Env, limit: number = 50): Promise<Triage[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM triages ORDER BY created_at DESC LIMIT ?'
  )
    .bind(limit)
    .all<Triage>();
  return result.results;
}

export async function getTriagesByIds(env: Env, ids: number[]): Promise<Triage[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT * FROM triages WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all<Triage>();
  return result.results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/db.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts test/db.test.ts
git commit -m "feat: D1 query helpers with tests"
```

---

## Task 4: AI Helpers

**Files:**
- Create: `src/lib/ai.ts`
- Create: `test/ai.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/ai.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getEmbedding, getVerdict } from '../src/lib/ai';
import type { Env } from '../src/types';

function makeMockEnv(aiRunReturn: unknown): Env {
  return {
    DB: {} as unknown as D1Database,
    AI: { run: vi.fn().mockResolvedValue(aiRunReturn) } as unknown as Ai,
    VECTORIZE: {} as unknown as VectorizeIndex,
  };
}

describe('getEmbedding', () => {
  it('calls AI.run with BGE model and returns first vector', async () => {
    const vector = Array(768).fill(0.1);
    const env = makeMockEnv({ data: [vector] });
    const result = await getEmbedding(env, 'test email text');
    expect(env.AI.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', { text: 'test email text' });
    expect(result).toEqual(vector);
    expect(result).toHaveLength(768);
  });
});

describe('getVerdict', () => {
  it('parses valid JSON verdict from LLM response', async () => {
    const env = makeMockEnv({ response: '{"verdict":"Phishing","reasoning":"Suspicious link detected."}' });
    const result = await getVerdict(env, 'some prompt');
    expect(result.verdict).toBe('Phishing');
    expect(result.reasoning).toBe('Suspicious link detected.');
  });

  it('extracts JSON even if LLM wraps it in prose', async () => {
    const env = makeMockEnv({
      response: 'Here is my analysis: {"verdict":"Safe","reasoning":"Looks legitimate."} End.',
    });
    const result = await getVerdict(env, 'prompt');
    expect(result.verdict).toBe('Safe');
  });

  it('throws if LLM returns no JSON', async () => {
    const env = makeMockEnv({ response: 'I cannot determine the verdict.' });
    await expect(getVerdict(env, 'prompt')).rejects.toThrow('LLM did not return valid JSON');
  });

  it('throws if verdict is not a valid value', async () => {
    const env = makeMockEnv({ response: '{"verdict":"Unknown","reasoning":"hmm"}' });
    await expect(getVerdict(env, 'prompt')).rejects.toThrow('Invalid verdict');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/ai.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/ai'`

- [ ] **Step 3: Write `src/lib/ai.ts`**

```typescript
import type { Env } from '../types';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5' as const;
const VERDICT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as const;

export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run(EMBEDDING_MODEL, { text }) as { data: number[][] };
  return result.data[0];
}

export async function getVerdict(
  env: Env,
  prompt: string
): Promise<{ verdict: string; reasoning: string }> {
  const result = await env.AI.run(VERDICT_MODEL, {
    messages: [{ role: 'user', content: prompt }],
  }) as { response: string };

  const jsonMatch = result.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]) as { verdict?: string; reasoning?: string };
  if (!parsed.verdict || !parsed.reasoning) {
    throw new Error('LLM response missing required fields');
  }
  if (!['Safe', 'Suspicious', 'Phishing'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`);
  }

  return { verdict: parsed.verdict, reasoning: parsed.reasoning };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/ai.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts test/ai.test.ts
git commit -m "feat: Workers AI helpers (embedding + verdict) with tests"
```

---

## Task 5: Analyze Route

**Files:**
- Create: `src/routes/analyze.ts`
- Create: `test/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/analyze.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleAnalyze } from '../src/routes/analyze';
import type { Env } from '../src/types';

function makeMockEnv(): Env {
  const stmt: any = {
    run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
  stmt.bind = vi.fn().mockReturnValue(stmt);
  return {
    DB: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    AI: {
      run: vi.fn()
        .mockResolvedValueOnce({ data: [Array(768).fill(0)] })
        .mockResolvedValueOnce({ response: '{"verdict":"Phishing","reasoning":"Fake login page."}' })
        .mockResolvedValueOnce({ data: [Array(768).fill(0)] }),
    } as unknown as Ai,
    VECTORIZE: {
      query: vi.fn().mockResolvedValue({ matches: [] }),
      insert: vi.fn().mockResolvedValue({}),
    } as unknown as VectorizeIndex,
  };
}

describe('handleAnalyze', () => {
  it('returns 400 for missing emailText', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleAnalyze(req, makeMockEnv());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('10 characters');
  });

  it('returns 400 for email text shorter than 10 chars', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ emailText: 'short' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleAnalyze(req, makeMockEnv());
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleAnalyze(req, makeMockEnv());
    expect(res.status).toBe(400);
  });

  it('returns 200 with verdict and reasoning on valid input', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ emailText: 'From: attacker@evil.com\nClick here to verify your account immediately or it will be suspended.' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleAnalyze(req, makeMockEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { verdict: string; reasoning: string; id: number };
    expect(body.verdict).toBe('Phishing');
    expect(body.reasoning).toBe('Fake login page.');
    expect(body.id).toBe(1);
  });

  it('returns 500 if AI verdict call fails', async () => {
    const stmt: any = {
      run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
    stmt.bind = vi.fn().mockReturnValue(stmt);
    const env: Env = {
      DB: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
      AI: {
        run: vi.fn()
          .mockResolvedValueOnce({ data: [Array(768).fill(0)] })
          .mockRejectedValueOnce(new Error('AI timeout')),
      } as unknown as Ai,
      VECTORIZE: {
        query: vi.fn().mockResolvedValue({ matches: [] }),
        insert: vi.fn().mockResolvedValue({}),
      } as unknown as VectorizeIndex,
    };
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ emailText: 'From: attacker@evil.com\nThis is a long enough email to analyze.' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleAnalyze(req, env);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Analysis failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/analyze.test.ts
```

Expected: FAIL — `Cannot find module '../src/routes/analyze'`

- [ ] **Step 3: Write `src/routes/analyze.ts`**

```typescript
import type { Env, Triage } from '../types';
import { extractSenderDomain } from '../lib/extract-domain';
import { getEmbedding, getVerdict } from '../lib/ai';
import { insertTriage, getTriagesByDomain, getTriagesByIds } from '../lib/db';

export async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  let body: { emailText?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { emailText } = body;
  if (!emailText || emailText.trim().length < 10) {
    return Response.json(
      { error: 'Email text must be at least 10 characters' },
      { status: 400 }
    );
  }

  const senderDomain = extractSenderDomain(emailText);

  const priorHistory: Triage[] = senderDomain
    ? await getTriagesByDomain(env, senderDomain)
    : [];

  // Generate embedding once — used for both similarity search and Vectorize storage
  let embedding: number[] | null = null;
  let similarEmails: (Triage & { score: number })[] = [];

  try {
    embedding = await getEmbedding(env, emailText);
    const vectorResults = await env.VECTORIZE.query(embedding, { topK: 3, returnMetadata: 'all' });
    if (vectorResults.matches.length > 0) {
      const ids = vectorResults.matches.map((m) => Number(m.metadata?.triage_id));
      const triages = await getTriagesByIds(env, ids);
      similarEmails = vectorResults.matches
        .map((m) => {
          const triage = triages.find((t) => t.id === Number(m.metadata?.triage_id));
          return triage ? { ...triage, score: m.score } : null;
        })
        .filter(Boolean) as (Triage & { score: number })[];
    }
  } catch {
    // Vectorize may be empty on first use — proceed without similar context
  }

  let verdict: string;
  let reasoning: string;
  try {
    const result = await getVerdict(
      env,
      buildPrompt(emailText, senderDomain, priorHistory, similarEmails)
    );
    verdict = result.verdict;
    reasoning = result.reasoning;
  } catch {
    return Response.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }

  const id = await insertTriage(env, {
    email_text: emailText,
    sender_domain: senderDomain,
    verdict,
    reasoning,
  });

  if (embedding) {
    try {
      await env.VECTORIZE.insert([{
        id: String(id),
        values: embedding,
        metadata: { triage_id: id, sender_domain: senderDomain ?? '', verdict },
      }]);
    } catch {
      // Non-fatal: triage saved to D1; vector search won't include this email until next run
    }
  }

  return Response.json({ id, verdict, reasoning, senderDomain, priorHistory, similarEmails });
}

function buildPrompt(
  emailText: string,
  senderDomain: string | null,
  priorHistory: Triage[],
  similarEmails: (Triage & { score: number })[]
): string {
  let context = '';

  if (priorHistory.length > 0 && senderDomain) {
    context += `\nPrior triages from sender domain "${senderDomain}":\n`;
    context += priorHistory
      .map((t) => `- ${t.verdict}: ${t.reasoning.slice(0, 150)}`)
      .join('\n');
    context += '\n';
  }

  if (similarEmails.length > 0) {
    context += `\nSemantically similar emails previously analyzed:\n`;
    context += similarEmails
      .map((t) => `- ${t.verdict} (${(t.score * 100).toFixed(0)}% match): ${t.reasoning.slice(0, 150)}`)
      .join('\n');
    context += '\n';
  }

  return `You are a cybersecurity expert analyzing emails for phishing indicators. Analyze the following email and return a JSON object with exactly this structure: {"verdict": "Safe" or "Suspicious" or "Phishing", "reasoning": "A clear paragraph explaining your verdict and the specific indicators that led to it"}
${context}
Email to analyze:
---
${emailText}
---

Return only the JSON object, no other text.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/analyze.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/analyze.ts test/analyze.test.ts
git commit -m "feat: analyze route — AI verdict + D1 + Vectorize flow, tests"
```

---

## Task 6: History Route

**Files:**
- Create: `src/routes/history.ts`
- Create: `test/history.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/history.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleHistory } from '../src/routes/history';
import type { Env, Triage } from '../src/types';

const mockTriages: Triage[] = [
  { id: 2, email_text: 'Phishing email body', sender_domain: 'evil.com', verdict: 'Phishing', reasoning: 'Bad link', created_at: '2026-04-25T10:00:00.000Z' },
  { id: 1, email_text: 'Normal email body', sender_domain: 'google.com', verdict: 'Safe', reasoning: 'Legitimate', created_at: '2026-04-25T09:00:00.000Z' },
];

function makeMockEnv(results: Triage[]): Env {
  const stmt: any = { all: vi.fn().mockResolvedValue({ results }) };
  stmt.bind = vi.fn().mockReturnValue(stmt);
  return {
    DB: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    AI: {} as unknown as Ai,
    VECTORIZE: {} as unknown as VectorizeIndex,
  };
}

describe('handleHistory', () => {
  it('returns 200 with list of triages', async () => {
    const req = new Request('http://localhost/api/history');
    const res = await handleHistory(req, makeMockEnv(mockTriages));
    expect(res.status).toBe(200);
    const body = await res.json() as Triage[];
    expect(body).toHaveLength(2);
    expect(body[0].verdict).toBe('Phishing');
  });

  it('passes default limit of 50', async () => {
    const req = new Request('http://localhost/api/history');
    const env = makeMockEnv([]);
    await handleHistory(req, env);
    const stmt = (env.DB.prepare as any).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(50);
  });

  it('respects custom ?limit query param', async () => {
    const req = new Request('http://localhost/api/history?limit=5');
    const env = makeMockEnv([]);
    await handleHistory(req, env);
    const stmt = (env.DB.prepare as any).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(5);
  });

  it('clamps limit to max 200', async () => {
    const req = new Request('http://localhost/api/history?limit=9999');
    const env = makeMockEnv([]);
    await handleHistory(req, env);
    const stmt = (env.DB.prepare as any).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/history.test.ts
```

Expected: FAIL — `Cannot find module '../src/routes/history'`

- [ ] **Step 3: Write `src/routes/history.ts`**

```typescript
import type { Env } from '../types';
import { getAllTriages } from '../lib/db';

export async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200);

  const triages = await getAllTriages(env, limit);
  return Response.json(triages);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/history.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/history.ts test/history.test.ts
git commit -m "feat: history route with limit param, tests"
```

---

## Task 7: Similar Route

**Files:**
- Create: `src/routes/similar.ts`
- Create: `test/similar.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/similar.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleSimilar } from '../src/routes/similar';
import type { Env, Triage } from '../src/types';

const mockTriage: Triage = {
  id: 3,
  email_text: 'Verify your account now',
  sender_domain: 'evil.com',
  verdict: 'Phishing',
  reasoning: 'Urgency tactic',
  created_at: '2026-04-25T10:00:00.000Z',
};

function makeMockEnv(
  vectorMatches: { id: string; score: number; metadata: Record<string, unknown> }[],
  triageResults: Triage[]
): Env {
  const stmt: any = { all: vi.fn().mockResolvedValue({ results: triageResults }) };
  stmt.bind = vi.fn().mockReturnValue(stmt);
  return {
    DB: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    AI: { run: vi.fn().mockResolvedValue({ data: [Array(768).fill(0)] }) } as unknown as Ai,
    VECTORIZE: {
      query: vi.fn().mockResolvedValue({ matches: vectorMatches }),
    } as unknown as VectorizeIndex,
  };
}

describe('handleSimilar', () => {
  it('returns 400 for missing emailText', async () => {
    const req = new Request('http://localhost/api/similar', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleSimilar(req, makeMockEnv([], []));
    expect(res.status).toBe(400);
  });

  it('returns 200 with matched triages enriched with score', async () => {
    const req = new Request('http://localhost/api/similar', {
      method: 'POST',
      body: JSON.stringify({ emailText: 'Verify your account immediately or it will be closed.' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const env = makeMockEnv(
      [{ id: '3', score: 0.92, metadata: { triage_id: 3 } }],
      [mockTriage]
    );
    const res = await handleSimilar(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as (Triage & { score: number })[];
    expect(body).toHaveLength(1);
    expect(body[0].score).toBe(0.92);
    expect(body[0].verdict).toBe('Phishing');
  });

  it('returns 200 with empty array when Vectorize has no matches', async () => {
    const req = new Request('http://localhost/api/similar', {
      method: 'POST',
      body: JSON.stringify({ emailText: 'A completely unique email nobody has seen.' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleSimilar(req, makeMockEnv([], []));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/similar.test.ts
```

Expected: FAIL — `Cannot find module '../src/routes/similar'`

- [ ] **Step 3: Write `src/routes/similar.ts`**

```typescript
import type { Env, Triage } from '../types';
import { getEmbedding } from '../lib/ai';
import { getTriagesByIds } from '../lib/db';

export async function handleSimilar(request: Request, env: Env): Promise<Response> {
  let body: { emailText?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { emailText } = body;
  if (!emailText || emailText.trim().length < 1) {
    return Response.json({ error: 'emailText is required' }, { status: 400 });
  }

  const embedding = await getEmbedding(env, emailText);
  const vectorResults = await env.VECTORIZE.query(embedding, { topK: 5, returnMetadata: 'all' });

  if (vectorResults.matches.length === 0) {
    return Response.json([]);
  }

  const ids = vectorResults.matches.map((m) => Number(m.metadata?.triage_id));
  const triages = await getTriagesByIds(env, ids);

  const result = vectorResults.matches
    .map((m) => {
      const triage = triages.find((t) => t.id === Number(m.metadata?.triage_id));
      return triage ? { ...triage, score: m.score } : null;
    })
    .filter(Boolean) as (Triage & { score: number })[];

  return Response.json(result);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/similar.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/similar.ts test/similar.test.ts
git commit -m "feat: similar-emails route with Vectorize semantic search, tests"
```

---

## Task 8: Worker Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write `src/index.ts`**

```typescript
import { handleAnalyze } from './routes/analyze';
import { handleHistory } from './routes/history';
import { handleSimilar } from './routes/similar';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (pathname === '/api/analyze' && method === 'POST') {
      return handleAnalyze(request, env);
    }
    if (pathname === '/api/history' && method === 'GET') {
      return handleHistory(request, env);
    }
    if (pathname === '/api/similar' && method === 'POST') {
      return handleSimilar(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (18 tests across 5 files).

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: Worker entry point — route dispatch for analyze, history, similar"
```

---

## Task 9: Frontend

**Files:**
- Create: `public/index.html`

**XSS safety note:** All user-derived content rendered into the page uses a `esc()` helper (DOM-based escaping via `textContent`) rather than raw string interpolation in `innerHTML`. This prevents stored XSS from email text or LLM reasoning that might contain HTML.

- [ ] **Step 1: Create `public/` directory**

```bash
mkdir -p public
```

- [ ] **Step 2: Write `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ThreatTriage</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .recording { animation: pulse 1s cubic-bezier(0.4,0,0.6,1) infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen font-mono">

  <!-- Nav -->
  <nav class="border-b border-gray-700 px-6 py-4 flex items-center gap-6">
    <span class="text-orange-400 font-bold text-lg tracking-tight">ThreatTriage</span>
    <button id="tab-analyze" class="text-sm px-3 py-1.5 rounded bg-orange-500 text-white font-medium">Analyze</button>
    <button id="tab-history" class="text-sm px-3 py-1.5 rounded text-gray-400 hover:text-white transition-colors">History</button>
  </nav>

  <!-- Analyze View -->
  <div id="view-analyze" class="max-w-3xl mx-auto px-6 py-8">
    <p class="text-gray-400 text-sm mb-4">Paste a suspicious email below to analyze it for phishing indicators.</p>
    <div class="relative">
      <textarea
        id="email-input"
        rows="10"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 pr-14 text-sm text-gray-100 resize-y focus:outline-none focus:border-orange-500 placeholder-gray-600"
        placeholder="Paste email here (headers + body)..."
      ></textarea>
      <button
        id="mic-btn"
        class="absolute top-3 right-3 p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-orange-400 transition-colors"
        title="Voice input"
      >mic</button>
    </div>
    <div class="mt-4 flex items-center gap-4">
      <button
        id="analyze-btn"
        class="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >Analyze</button>
      <span id="status-text" class="text-gray-500 text-sm hidden">Analyzing...</span>
    </div>

    <!-- Results -->
    <div id="results" class="mt-8 hidden">
      <div class="flex items-center gap-3 mb-4">
        <span class="text-gray-400 text-sm font-medium">VERDICT</span>
        <span id="verdict-badge" class="px-3 py-1 rounded-full border text-sm font-medium"></span>
      </div>
      <p id="reasoning-text" class="text-gray-300 text-sm leading-relaxed bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4"></p>
      <div id="similar-section" class="hidden">
        <p class="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">Similar past emails</p>
        <div id="similar-list" class="space-y-2"></div>
      </div>
      <div id="prior-section" class="hidden mt-4">
        <p class="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wide">Prior triages from this sender</p>
        <div id="prior-list" class="space-y-2"></div>
      </div>
    </div>
    <p id="error-box" class="mt-4 hidden bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-lg p-3"></p>
  </div>

  <!-- History View -->
  <div id="view-history" class="max-w-3xl mx-auto px-6 py-8 hidden">
    <p class="text-gray-400 text-sm mb-4">Past triages, newest first.</p>
    <div id="history-list" class="space-y-2"></div>
    <p id="history-empty" class="text-gray-600 text-sm hidden">No triages yet.</p>
  </div>

<script>
  // ── Safe DOM helper — escapes user content before inserting into the DOM ──
  function esc(str) {
    const el = document.createElement('span');
    el.textContent = String(str ?? '');
    return el.innerHTML; // browser-escaped HTML entities
  }

  // ── Verdict helpers ───────────────────────────────────────────────────────
  function verdictClasses(verdict) {
    const map = {
      Safe:       'bg-green-900/60 text-green-300 border-green-700',
      Suspicious: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
      Phishing:   'bg-red-900/60 text-red-300 border-red-700',
    };
    return map[verdict] || 'bg-gray-800 text-gray-300 border-gray-600';
  }

  // Builds a triage card using esc() for all user-derived strings
  function buildTriageCard(t) {
    const card = document.createElement('div');
    card.className = 'bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gray-500 transition-colors';

    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 flex-wrap';

    const badge = document.createElement('span');
    badge.className = 'px-2 py-0.5 rounded-full border text-xs font-medium ' + verdictClasses(t.verdict);
    badge.textContent = t.verdict;

    const domain = document.createElement('span');
    domain.className = 'text-gray-400 text-xs';
    domain.textContent = t.sender_domain || 'unknown sender';

    const ts = document.createElement('span');
    ts.className = 'text-gray-600 text-xs ml-auto';
    ts.textContent = new Date(t.created_at).toLocaleString();

    header.appendChild(badge);
    header.appendChild(domain);
    header.appendChild(ts);

    const preview = document.createElement('p');
    preview.className = 'text-gray-500 text-xs mt-1.5 truncate';
    preview.textContent = (t.email_text || '').slice(0, 100) + '…';

    const detail = document.createElement('div');
    detail.className = 'hidden mt-3 text-gray-300 text-sm leading-relaxed border-t border-gray-700 pt-3';
    detail.textContent = t.reasoning || '';

    card.appendChild(header);
    card.appendChild(preview);
    card.appendChild(detail);
    card.addEventListener('click', () => detail.classList.toggle('hidden'));
    return card;
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabAnalyze  = document.getElementById('tab-analyze');
  const tabHistory  = document.getElementById('tab-history');
  const viewAnalyze = document.getElementById('view-analyze');
  const viewHistory = document.getElementById('view-history');

  function showTab(tab) {
    const isAnalyze = tab === 'analyze';
    viewAnalyze.classList.toggle('hidden', !isAnalyze);
    viewHistory.classList.toggle('hidden', isAnalyze);
    tabAnalyze.className = 'text-sm px-3 py-1.5 rounded font-medium ' +
      (isAnalyze ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white transition-colors');
    tabHistory.className = 'text-sm px-3 py-1.5 rounded font-medium ' +
      (!isAnalyze ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white transition-colors');
    if (!isAnalyze) loadHistory();
  }

  tabAnalyze.addEventListener('click', () => showTab('analyze'));
  tabHistory.addEventListener('click', () => showTab('history'));

  // ── Analyze ───────────────────────────────────────────────────────────────
  const emailInput    = document.getElementById('email-input');
  const analyzeBtn    = document.getElementById('analyze-btn');
  const statusText    = document.getElementById('status-text');
  const resultsEl     = document.getElementById('results');
  const errorBox      = document.getElementById('error-box');
  const verdictBadge  = document.getElementById('verdict-badge');
  const reasoningText = document.getElementById('reasoning-text');
  const similarSection = document.getElementById('similar-section');
  const similarList   = document.getElementById('similar-list');
  const priorSection  = document.getElementById('prior-section');
  const priorList     = document.getElementById('prior-list');

  analyzeBtn.addEventListener('click', async () => {
    const emailText = emailInput.value.trim();
    if (emailText.length < 10) {
      showError('Please paste at least 10 characters of email text.');
      return;
    }
    setLoading(true);
    errorBox.classList.add('hidden');
    resultsEl.classList.add('hidden');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailText }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Analysis failed.'); return; }

      verdictBadge.textContent = data.verdict;
      verdictBadge.className = 'px-3 py-1 rounded-full border text-sm font-medium ' + verdictClasses(data.verdict);
      reasoningText.textContent = data.reasoning;

      similarList.replaceChildren();
      if (data.similarEmails && data.similarEmails.length > 0) {
        data.similarEmails.forEach((t) => {
          const row = document.createElement('div');
          row.className = 'text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded p-2 flex items-center gap-2';
          const vb = document.createElement('span');
          vb.className = 'px-1.5 py-0.5 rounded border text-xs ' + verdictClasses(t.verdict);
          vb.textContent = t.verdict;
          const pct = document.createElement('span');
          pct.textContent = (t.score * 100).toFixed(0) + '% match';
          const dom = document.createElement('span');
          dom.className = 'text-gray-600';
          dom.textContent = t.sender_domain || 'unknown';
          row.appendChild(vb); row.appendChild(pct); row.appendChild(dom);
          similarList.appendChild(row);
        });
        similarSection.classList.remove('hidden');
      } else {
        similarSection.classList.add('hidden');
      }

      priorList.replaceChildren();
      if (data.priorHistory && data.priorHistory.length > 0) {
        data.priorHistory.forEach((t) => {
          const row = document.createElement('div');
          row.className = 'text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded p-2 flex items-center gap-2';
          const vb = document.createElement('span');
          vb.className = 'px-1.5 py-0.5 rounded border ' + verdictClasses(t.verdict);
          vb.textContent = t.verdict;
          const dt = document.createElement('span');
          dt.className = 'text-gray-600';
          dt.textContent = new Date(t.created_at).toLocaleDateString();
          row.appendChild(vb); row.appendChild(dt);
          priorList.appendChild(row);
        });
        priorSection.classList.remove('hidden');
      } else {
        priorSection.classList.add('hidden');
      }

      resultsEl.classList.remove('hidden');
    } catch {
      showError('Network error. Is the Worker running?');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(on) {
    analyzeBtn.disabled = on;
    statusText.classList.toggle('hidden', !on);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  // ── History ───────────────────────────────────────────────────────────────
  async function loadHistory() {
    const historyList  = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    historyList.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'text-gray-600 text-sm';
    loading.textContent = 'Loading...';
    historyList.appendChild(loading);

    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      historyList.replaceChildren();
      if (!data.length) {
        historyEmpty.classList.remove('hidden');
      } else {
        historyEmpty.classList.add('hidden');
        data.forEach((t) => historyList.appendChild(buildTriageCard(t)));
      }
    } catch {
      historyList.replaceChildren();
      const err = document.createElement('p');
      err.className = 'text-red-400 text-sm';
      err.textContent = 'Failed to load history.';
      historyList.appendChild(err);
    }
  }

  // ── Voice input ───────────────────────────────────────────────────────────
  const micBtn = document.getElementById('mic-btn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.style.display = 'none';
  } else {
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    micBtn.addEventListener('click', () => {
      recognition.start();
      micBtn.classList.add('recording', 'text-orange-400');
    });
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      emailInput.value += (emailInput.value ? ' ' : '') + transcript;
      micBtn.classList.remove('recording', 'text-orange-400');
    };
    recognition.onerror = () => {
      micBtn.classList.remove('recording', 'text-orange-400');
    };
  }
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: single-page frontend — dark theme, analyze + history tabs, voice input"
```

---

## Task 10: Provision Cloudflare Resources & Deploy

- [ ] **Step 1: Log in to Cloudflare**

```bash
npx wrangler login
```

Expected: Browser opens → authorize → terminal prints "Successfully logged in."

- [ ] **Step 2: Create the D1 database**

```bash
npx wrangler d1 create threat-triage-db
```

Expected output (example):
```
Successfully created DB 'threat-triage-db'
{
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Copy the `database_id`. In `wrangler.toml`, replace `PLACEHOLDER` with this value.

- [ ] **Step 3: Apply the schema**

```bash
npx wrangler d1 execute threat-triage-db --file=./schema.sql
```

Expected: `Executed 1 query.`

- [ ] **Step 4: Create the Vectorize index**

```bash
npx wrangler vectorize create triage-embeddings --dimensions=768 --metric=cosine
```

Expected: `Successfully created index 'triage-embeddings'`

- [ ] **Step 5: Run the full test suite one final time**

```bash
npx vitest run
```

Expected: All 18 tests pass.

- [ ] **Step 6: Test locally**

```bash
npx wrangler dev
```

Open `http://localhost:8787`. Paste this email and click Analyze:

```
From: security-alert@paypa1-support.com
Subject: Urgent: Your account has been limited

Dear Customer,

We have detected unusual activity on your PayPal account. Your account has been temporarily limited.

Click here to verify your identity: http://paypa1-support.com/verify?token=abc123

If you do not verify within 24 hours, your account will be permanently suspended.

PayPal Security Team
```

Expected: Verdict panel appears with a "Phishing" badge and reasoning.

- [ ] **Step 7: Deploy**

```bash
npx wrangler deploy
```

Expected:
```
Deployed threat-triage to https://threat-triage.<your-subdomain>.workers.dev
```

- [ ] **Step 8: Smoke test the deployed URL**

Open the deployed URL. Paste the same test email. Confirm analyze works, then click the History tab and verify the triage appears.

- [ ] **Step 9: Commit updated wrangler.toml**

```bash
git add wrangler.toml
git commit -m "chore: add real D1 database_id to wrangler.toml"
```
