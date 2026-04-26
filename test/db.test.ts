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
    const stmt = (env.DB.prepare as any).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith(
      'test email',
      'evil.com',
      'Phishing',
      'Suspicious link',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
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
