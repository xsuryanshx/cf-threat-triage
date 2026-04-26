import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

function makeMockEnv(): Env {
  const stmt: any = {
    run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue({ total: 0, safe: 0, suspicious: 0, phishing: 0 }),
  };
  stmt.bind = vi.fn().mockReturnValue(stmt);
  return {
    DB: { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database,
    AI: {
      run: vi.fn()
        .mockResolvedValue({ data: [Array(768).fill(0)] }),
    } as unknown as Ai,
    VECTORIZE: {
      query: vi.fn().mockResolvedValue({ matches: [] }),
      insert: vi.fn().mockResolvedValue({}),
    } as unknown as VectorizeIndex,
  };
}

describe('Worker router', () => {
  it('returns 404 for unknown routes', async () => {
    const req = new Request('http://localhost/api/unknown');
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(404);
  });

  it('returns 404 for wrong method on /api/analyze', async () => {
    const req = new Request('http://localhost/api/analyze', { method: 'GET' });
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(404);
  });

  it('returns 404 for wrong method on /api/history', async () => {
    const req = new Request('http://localhost/api/history', { method: 'POST' });
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(404);
  });

  it('returns 404 for wrong method on /api/stats', async () => {
    const req = new Request('http://localhost/api/stats', { method: 'POST' });
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(404);
  });

  it('handles CORS preflight OPTIONS', async () => {
    const req = new Request('http://localhost/api/analyze', { method: 'OPTIONS' });
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('routes GET /api/history correctly', async () => {
    const req = new Request('http://localhost/api/history');
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('routes GET /api/stats correctly', async () => {
    const req = new Request('http://localhost/api/stats');
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body).toHaveProperty('total');
  });

  it('routes POST /api/analyze with valid body', async () => {
    const env = makeMockEnv();
    // Override AI to return verdict on second call
    (env.AI.run as any)
      .mockResolvedValueOnce({ data: [Array(768).fill(0)] }) // embedding
      .mockResolvedValueOnce({
        response: '{"verdict":"Safe","confidence":10,"reasoning":"Looks fine.","indicators":[]}'
      });

    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'From: friend@legit.com\nHey, are we still on for lunch tomorrow?' }),
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verdict).toBe('Safe');
    expect(body.confidence).toBe(10);
  });

  it('routes POST /api/similar with valid body', async () => {
    const req = new Request('http://localhost/api/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailText: 'Verify your account immediately or it will be closed.' }),
    });
    const res = await worker.fetch(req, makeMockEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
