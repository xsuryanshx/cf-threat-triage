import { describe, it, expect, vi } from 'vitest';
import { handleSimilar } from '../src/routes/similar';
import type { Env, Triage } from '../src/types';

const mockTriage: Triage = {
  id: 3,
  email_text: 'Verify your account now',
  sender_domain: 'evil.com',
  verdict: 'Phishing',
  confidence: 88,
  reasoning: 'Urgency tactic',
  indicators: '[]',
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
