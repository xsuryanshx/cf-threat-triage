import { describe, it, expect, vi } from 'vitest';
import { handleHistory } from '../src/routes/history';
import type { Env, Triage } from '../src/types';

const mockTriages: Triage[] = [
  { id: 2, email_text: 'Phishing email body', sender_domain: 'evil.com', verdict: 'Phishing', confidence: 92, reasoning: 'Bad link', indicators: '[]', created_at: '2026-04-25T10:00:00.000Z' },
  { id: 1, email_text: 'Normal email body', sender_domain: 'google.com', verdict: 'Safe', confidence: 15, reasoning: 'Legitimate', indicators: '[]', created_at: '2026-04-25T09:00:00.000Z' },
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
