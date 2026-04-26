import { describe, it, expect, vi } from 'vitest';
import { handleStats } from '../src/routes/stats';
import type { Env } from '../src/types';

function makeMockEnv(totals: any, domains: any[], activity: any[]): Env {
  const prepareResults: any[] = [];

  // getStats calls prepare 3 times via Promise.all
  const firstStmt = { first: vi.fn().mockResolvedValue(totals) };
  const secondStmt = { all: vi.fn().mockResolvedValue({ results: domains }) };
  const thirdStmt = { all: vi.fn().mockResolvedValue({ results: activity }) };

  return {
    DB: {
      prepare: vi.fn()
        .mockReturnValueOnce(firstStmt)
        .mockReturnValueOnce(secondStmt)
        .mockReturnValueOnce(thirdStmt),
    } as unknown as D1Database,
    AI: {} as unknown as Ai,
    VECTORIZE: {} as unknown as VectorizeIndex,
  };
}

describe('handleStats', () => {
  it('returns 200 with aggregated stats', async () => {
    const env = makeMockEnv(
      { total: 10, safe: 5, suspicious: 3, phishing: 2 },
      [{ domain: 'evil.com', count: 4, phishing_count: 3 }],
      [{ date: '2026-04-25', count: 5 }]
    );
    const req = new Request('http://localhost/api/stats');
    const res = await handleStats(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(10);
    expect(body.safe).toBe(5);
    expect(body.suspicious).toBe(3);
    expect(body.phishing).toBe(2);
    expect(body.topDomains).toHaveLength(1);
    expect(body.topDomains[0].domain).toBe('evil.com');
    expect(body.recentActivity).toHaveLength(1);
  });

  it('returns 200 with zeros when DB is empty', async () => {
    const env = makeMockEnv(
      { total: 0, safe: 0, suspicious: 0, phishing: 0 },
      [],
      []
    );
    const req = new Request('http://localhost/api/stats');
    const res = await handleStats(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(0);
    expect(body.topDomains).toEqual([]);
    expect(body.recentActivity).toEqual([]);
  });

  it('returns 200 with defaults when first() returns null', async () => {
    const env = makeMockEnv(null, [], []);
    const req = new Request('http://localhost/api/stats');
    const res = await handleStats(req, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(0);
    expect(body.safe).toBe(0);
  });

  it('returns 500 when DB throws', async () => {
    const env: Env = {
      DB: { prepare: vi.fn().mockImplementation(() => { throw new Error('DB down'); }) } as unknown as D1Database,
      AI: {} as unknown as Ai,
      VECTORIZE: {} as unknown as VectorizeIndex,
    };
    const req = new Request('http://localhost/api/stats');
    const res = await handleStats(req, env);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Failed to load stats');
  });
});
