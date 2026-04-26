import { describe, it, expect, vi } from 'vitest';
import { getVerdict } from '../src/lib/ai';
import type { Env } from '../src/types';

describe('getVerdict model fallback', () => {
  it('falls back to second model when first fails', async () => {
    const env: Env = {
      DB: {} as unknown as D1Database,
      AI: {
        run: vi.fn()
          // First model throws
          .mockRejectedValueOnce(new Error('model unavailable'))
          // Second model succeeds
          .mockResolvedValueOnce({
            response: '{"verdict":"Phishing","confidence":80,"reasoning":"Bad email.","indicators":[]}'
          }),
      } as unknown as Ai,
      VECTORIZE: {} as unknown as VectorizeIndex,
    };

    const result = await getVerdict(env, 'test prompt');
    expect(result.verdict).toBe('Phishing');
    expect(result.confidence).toBe(80);
    expect(env.AI.run).toHaveBeenCalledTimes(2);
  });

  it('falls back to third model when first two fail', async () => {
    const env: Env = {
      DB: {} as unknown as D1Database,
      AI: {
        run: vi.fn()
          .mockRejectedValueOnce(new Error('model 1 down'))
          .mockRejectedValueOnce(new Error('model 2 down'))
          .mockResolvedValueOnce({
            response: '{"verdict":"Safe","confidence":20,"reasoning":"Fine.","indicators":[]}'
          }),
      } as unknown as Ai,
      VECTORIZE: {} as unknown as VectorizeIndex,
    };

    const result = await getVerdict(env, 'test prompt');
    expect(result.verdict).toBe('Safe');
    expect(env.AI.run).toHaveBeenCalledTimes(3);
  });

  it('throws when all models fail', async () => {
    const env: Env = {
      DB: {} as unknown as D1Database,
      AI: {
        run: vi.fn()
          .mockRejectedValueOnce(new Error('model 1 down'))
          .mockRejectedValueOnce(new Error('model 2 down'))
          .mockRejectedValueOnce(new Error('model 3 down')),
      } as unknown as Ai,
      VECTORIZE: {} as unknown as VectorizeIndex,
    };

    await expect(getVerdict(env, 'test')).rejects.toThrow('model 3 down');
  });

  it('skips model that returns empty response and tries next', async () => {
    const env: Env = {
      DB: {} as unknown as D1Database,
      AI: {
        run: vi.fn()
          // First model returns empty
          .mockResolvedValueOnce({ response: '' })
          // Second model succeeds
          .mockResolvedValueOnce({
            response: '{"verdict":"Suspicious","confidence":60,"reasoning":"Hmm.","indicators":[]}'
          }),
      } as unknown as Ai,
      VECTORIZE: {} as unknown as VectorizeIndex,
    };

    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Suspicious');
    expect(env.AI.run).toHaveBeenCalledTimes(2);
  });

  it('skips model that returns null result and tries next', async () => {
    const env: Env = {
      DB: {} as unknown as D1Database,
      AI: {
        run: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            response: '{"verdict":"Safe","confidence":10,"reasoning":"OK.","indicators":[]}'
          }),
      } as unknown as Ai,
      VECTORIZE: {} as unknown as VectorizeIndex,
    };

    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Safe');
    expect(env.AI.run).toHaveBeenCalledTimes(2);
  });
});
