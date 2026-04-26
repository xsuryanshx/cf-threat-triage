import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';
import type { Env, Triage } from '../src/types';

/**
 * End-to-end flow tests verifying the full pipeline:
 * analyze → persists to D1 → embeds to Vectorize → appears in history → found via similar
 */

// Shared state to track what was inserted
let insertedRows: any[] = [];
let insertedVectors: any[] = [];

function makeE2EEnv(): Env {
  insertedRows = [];
  insertedVectors = [];
  let nextId = 1;

  const makeStmt = (sql: string) => {
    const stmt: any = {};

    stmt.bind = vi.fn((...args: any[]) => {
      stmt._boundArgs = args;
      return stmt;
    });

    stmt.run = vi.fn(async () => {
      const id = nextId++;
      const row = {
        id,
        email_text: stmt._boundArgs?.[0],
        sender_domain: stmt._boundArgs?.[1],
        verdict: stmt._boundArgs?.[2],
        confidence: stmt._boundArgs?.[3],
        reasoning: stmt._boundArgs?.[4],
        indicators: stmt._boundArgs?.[5],
        created_at: stmt._boundArgs?.[6],
      };
      insertedRows.push(row);
      return { meta: { last_row_id: id } };
    });

    stmt.all = vi.fn(async () => {
      // If querying history, return inserted rows
      if (sql.includes('ORDER BY created_at DESC LIMIT')) {
        return { results: [...insertedRows].reverse() };
      }
      // If querying by domain
      if (sql.includes('sender_domain = ?')) {
        const domain = stmt._boundArgs?.[0];
        return { results: insertedRows.filter(r => r.sender_domain === domain) };
      }
      // If querying by IDs
      if (sql.includes('IN')) {
        const ids = stmt._boundArgs;
        return { results: insertedRows.filter(r => ids?.includes(r.id)) };
      }
      return { results: [] };
    });

    stmt.first = vi.fn(async () => {
      const safe = insertedRows.filter(r => r.verdict === 'Safe').length;
      const suspicious = insertedRows.filter(r => r.verdict === 'Suspicious').length;
      const phishing = insertedRows.filter(r => r.verdict === 'Phishing').length;
      return { total: insertedRows.length, safe, suspicious, phishing };
    });

    return stmt;
  };

  return {
    DB: {
      prepare: vi.fn((sql: string) => makeStmt(sql)),
    } as unknown as D1Database,
    AI: {
      run: vi.fn(async (model: string, input: any) => {
        // Embedding model
        if (model.includes('bge')) {
          return { data: [Array(768).fill(0.1)] };
        }
        // LLM model — return phishing for evil.com, safe otherwise
        const content = input.messages?.[1]?.content || '';
        if (content.includes('evil.com') || content.includes('paypa1')) {
          return {
            response: JSON.stringify({
              verdict: 'Phishing',
              confidence: 92,
              reasoning: 'This email contains classic phishing indicators including urgency language and suspicious URLs.',
              indicators: [
                { type: 'suspicious_url', detail: 'Link points to typosquatting domain', severity: 'critical' },
                { type: 'urgency_language', detail: 'Account suspension threat', severity: 'high' },
              ]
            })
          };
        }
        return {
          response: JSON.stringify({
            verdict: 'Safe',
            confidence: 15,
            reasoning: 'This appears to be a legitimate email with no phishing indicators.',
            indicators: [
              { type: 'legitimate_sender', detail: 'Known trusted domain', severity: 'low' },
            ]
          })
        };
      }),
    } as unknown as Ai,
    VECTORIZE: {
      query: vi.fn(async () => {
        // Return previously inserted vectors as matches
        if (insertedVectors.length === 0) return { matches: [] };
        return {
          matches: insertedVectors.map(v => ({
            id: v.id,
            score: 0.95,
            metadata: v.metadata,
          })),
        };
      }),
      insert: vi.fn(async (vectors: any[]) => {
        insertedVectors.push(...vectors);
      }),
    } as unknown as VectorizeIndex,
  };
}

describe('E2E: Analyze → History → Stats flow', () => {
  it('analyzes a phishing email and returns full result with indicators', async () => {
    const env = makeE2EEnv();
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailText: 'From: security@paypa1-support.com\nSubject: Urgent: Account Locked\n\nDear Customer,\nYour account has been limited. Click http://paypa1-support.com/verify to restore access.\nIf you do not verify within 24 hours, your account will be permanently suspended.'
      }),
    });

    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await res.json() as any;

    // Verify verdict
    expect(body.verdict).toBe('Phishing');
    expect(body.confidence).toBeGreaterThan(50);
    expect(body.reasoning).toBeTruthy();
    expect(typeof body.reasoning).toBe('string');

    // Verify indicators are structured
    expect(Array.isArray(body.indicators)).toBe(true);
    expect(body.indicators.length).toBeGreaterThan(0);
    body.indicators.forEach((ind: any) => {
      expect(ind).toHaveProperty('type');
      expect(ind).toHaveProperty('detail');
      expect(ind).toHaveProperty('severity');
      expect(['critical', 'high', 'medium', 'low']).toContain(ind.severity);
    });

    // Verify URL extraction
    expect(Array.isArray(body.urls)).toBe(true);
    expect(body.urls.length).toBeGreaterThan(0);
    const susUrl = body.urls.find((u: any) => u.url.includes('paypa1'));
    expect(susUrl).toBeDefined();
    expect(susUrl.suspicious).toBe(true);

    // Verify sender domain extraction
    expect(body.senderDomain).toBe('paypa1-support.com');

    // Verify ID was returned (persisted to D1)
    expect(body.id).toBe(1);

    // Verify it was stored in D1
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].verdict).toBe('Phishing');

    // Verify embedding was stored in Vectorize
    expect(insertedVectors).toHaveLength(1);
    expect(insertedVectors[0].metadata.triage_id).toBe(1);
    expect(insertedVectors[0].metadata.verdict).toBe('Phishing');
  });

  it('analyzed email appears in history', async () => {
    const env = makeE2EEnv();

    // Step 1: Analyze an email
    const analyzeReq = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: friend@legit.com\nHey, are we still on for lunch tomorrow at noon?' }),
    });
    const analyzeRes = await worker.fetch(analyzeReq, env);
    expect(analyzeRes.status).toBe(200);
    const analyzeBody = await analyzeRes.json() as any;
    expect(analyzeBody.verdict).toBe('Safe');

    // Step 2: Fetch history
    const historyReq = new Request('http://localhost/api/history');
    const historyRes = await worker.fetch(historyReq, env);
    expect(historyRes.status).toBe(200);
    const history = await historyRes.json() as any[];
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].verdict).toBe('Safe');
    expect(history[0].sender_domain).toBe('legit.com');
  });

  it('analyzed email appears in stats', async () => {
    const env = makeE2EEnv();

    // Analyze a phishing email
    const req1 = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: scam@evil.com\nClick here immediately to claim your prize or your account will be deleted!' }),
    });
    await worker.fetch(req1, env);

    // Analyze a safe email
    const req2 = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: team@legit.com\nHi team, the meeting has been moved to 3pm tomorrow.' }),
    });
    await worker.fetch(req2, env);

    // Fetch stats
    const statsReq = new Request('http://localhost/api/stats');
    const statsRes = await worker.fetch(statsReq, env);
    expect(statsRes.status).toBe(200);
    const stats = await statsRes.json() as any;
    expect(stats.total).toBe(2);
    expect(stats.phishing).toBe(1);
    expect(stats.safe).toBe(1);
  });

  it('second email from same domain sees prior history', async () => {
    const env = makeE2EEnv();

    // First analysis from evil.com
    const req1 = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: alert@evil.com\nYour account is compromised! Click http://evil.com/fix now!' }),
    });
    const res1 = await worker.fetch(req1, env);
    expect(res1.status).toBe(200);

    // Second analysis from same domain
    const req2 = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: support@evil.com\nUrgent security update required. Click http://evil.com/update immediately.' }),
    });
    const res2 = await worker.fetch(req2, env);
    expect(res2.status).toBe(200);
    const body2 = await res2.json() as any;

    // Should have prior history from the first analysis
    expect(body2.priorHistory.length).toBeGreaterThan(0);
    expect(body2.priorHistory[0].sender_domain).toBe('evil.com');
  });

  it('similar endpoint finds previously analyzed emails', async () => {
    const env = makeE2EEnv();

    // Analyze an email first (populates Vectorize)
    const analyzeReq = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: scam@evil.com\nYour PayPal account has been limited. Verify now.' }),
    });
    await worker.fetch(analyzeReq, env);

    // Now search for similar
    const similarReq = new Request('http://localhost/api/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'Your PayPal account is suspended. Click to verify.' }),
    });
    const similarRes = await worker.fetch(similarReq, env);
    expect(similarRes.status).toBe(200);
    const similar = await similarRes.json() as any[];
    expect(similar.length).toBeGreaterThan(0);
    expect(similar[0]).toHaveProperty('score');
    expect(similar[0].score).toBeGreaterThan(0.5);
  });
});

describe('E2E: Analyze safe email flow', () => {
  it('correctly identifies a safe email with proper indicators', async () => {
    const env = makeE2EEnv();
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailText: 'From: alice@company.com\nSubject: Q3 Planning\n\nHi team,\n\nPlease review the Q3 planning doc and add your comments by Friday.\n\nThanks,\nAlice'
      }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verdict).toBe('Safe');
    expect(body.confidence).toBeLessThan(50);
    expect(body.senderDomain).toBe('company.com');
    expect(body.urls).toEqual([]); // no URLs in this email
    expect(body.indicators.length).toBeGreaterThan(0);
  });
});

describe('E2E: Error handling', () => {
  it('returns 400 for empty body', async () => {
    const env = makeE2EEnv();
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: '' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 for too-short email', async () => {
    const env = makeE2EEnv();
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'hi' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('analyze still works when embedding fails', async () => {
    const env = makeE2EEnv();
    // Override AI.run to fail on embedding but succeed on verdict
    let callCount = 0;
    (env.AI.run as any).mockImplementation(async (model: string, input: any) => {
      callCount++;
      if (model.includes('bge')) {
        throw new Error('Embedding service down');
      }
      return {
        response: '{"verdict":"Phishing","confidence":75,"reasoning":"Looks bad.","indicators":[]}'
      };
    });

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: bad@evil.com\nYour account is compromised! Act now!' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verdict).toBe('Phishing');
    // No embedding means no similar emails and no Vectorize insert
    expect(body.similarEmails).toEqual([]);
    expect(insertedVectors).toHaveLength(0);
  });

  it('analyze still works when Vectorize query fails', async () => {
    const env = makeE2EEnv();
    (env.VECTORIZE.query as any).mockRejectedValue(new Error('Vectorize down'));

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: test@evil.com\nClick here immediately to verify your identity!' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verdict).toBe('Phishing');
    expect(body.similarEmails).toEqual([]);
  });

  it('similar endpoint returns 400 for missing emailText', async () => {
    const env = makeE2EEnv();
    const req = new Request('http://localhost/api/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('history returns empty array when no triages exist', async () => {
    const env = makeE2EEnv();
    const req = new Request('http://localhost/api/history');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body).toEqual([]);
  });
});
