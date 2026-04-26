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
        .mockResolvedValueOnce({ data: [Array(768).fill(0)] }) // embedding
        .mockResolvedValueOnce({
          response: '{"verdict":"Phishing","confidence":90,"reasoning":"Fake login page.","indicators":[{"type":"suspicious_url","detail":"fake link","severity":"high"}]}'
        }),
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

  it('returns 200 with verdict, confidence, and indicators on valid input', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ emailText: 'From: attacker@evil.com\nClick here to verify your account immediately or it will be suspended.' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleAnalyze(req, makeMockEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verdict).toBe('Phishing');
    expect(body.confidence).toBe(90);
    expect(body.reasoning).toBe('Fake login page.');
    expect(body.indicators).toHaveLength(1);
    expect(body.id).toBe(1);
    expect(body.urls).toBeDefined();
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
