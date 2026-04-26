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
  it('parses valid JSON verdict with indicators', async () => {
    const env = makeMockEnv({
      response: '{"verdict":"Phishing","confidence":92,"reasoning":"Suspicious link detected.","indicators":[{"type":"suspicious_url","detail":"fake link","severity":"high"}]}'
    });
    const result = await getVerdict(env, 'some prompt');
    expect(result.verdict).toBe('Phishing');
    expect(result.confidence).toBe(92);
    expect(result.reasoning).toBe('Suspicious link detected.');
    expect(result.indicators).toHaveLength(1);
    expect(result.indicators[0].type).toBe('suspicious_url');
  });

  it('extracts JSON even if LLM wraps it in markdown fences', async () => {
    const env = makeMockEnv({
      response: '```json\n{"verdict":"Safe","confidence":15,"reasoning":"Looks legitimate.","indicators":[]}\n```',
    });
    const result = await getVerdict(env, 'prompt');
    expect(result.verdict).toBe('Safe');
    expect(result.confidence).toBe(15);
  });

  it('provides default confidence when LLM omits it', async () => {
    const env = makeMockEnv({
      response: '{"verdict":"Phishing","reasoning":"Bad email.","indicators":[]}',
    });
    const result = await getVerdict(env, 'prompt');
    expect(result.confidence).toBe(85); // default for Phishing
  });

  it('throws if LLM returns no JSON', async () => {
    const env = makeMockEnv({ response: 'I cannot determine the verdict.' });
    await expect(getVerdict(env, 'prompt')).rejects.toThrow('LLM did not return valid JSON');
  });

  it('throws if verdict is not a valid value', async () => {
    const env = makeMockEnv({ response: '{"verdict":"Unknown","reasoning":"hmm","indicators":[]}' });
    await expect(getVerdict(env, 'prompt')).rejects.toThrow('Invalid verdict');
  });

  it('handles missing indicators gracefully', async () => {
    const env = makeMockEnv({
      response: '{"verdict":"Safe","confidence":10,"reasoning":"Fine."}',
    });
    const result = await getVerdict(env, 'prompt');
    expect(result.indicators).toEqual([]);
  });
});
