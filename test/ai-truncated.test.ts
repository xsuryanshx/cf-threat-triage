import { describe, it, expect, vi } from 'vitest';
import { getVerdict } from '../src/lib/ai';
import type { Env } from '../src/types';

function makeMockEnv(response: string): Env {
  return {
    DB: {} as unknown as D1Database,
    AI: { run: vi.fn().mockResolvedValue({ response }) } as unknown as Ai,
    VECTORIZE: {} as unknown as VectorizeIndex,
  };
}

describe('getVerdict with truncated JSON', () => {
  it('repairs JSON truncated mid-indicators array', async () => {
    // Simulates LLM output cut off mid-way through indicators
    const truncated = `{
  "verdict": "Phishing",
  "confidence": 95,
  "reasoning": "This is a phishing email.",
  "indicators": [
    {"type": "urgency_language", "detail": "Account suspension threat", "severity": "high"},
    {"type": "credential_request", "detail": "Asks for SSN and PIN`;

    const env = makeMockEnv(truncated);
    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Phishing');
    expect(result.confidence).toBe(95);
    expect(result.reasoning).toBe('This is a phishing email.');
    // Should recover at least the first complete indicator
    expect(result.indicators.length).toBeGreaterThanOrEqual(1);
    expect(result.indicators[0].type).toBe('urgency_language');
  });

  it('repairs JSON truncated after reasoning with no indicators', async () => {
    const truncated = `{
  "verdict": "Suspicious",
  "confidence": 60,
  "reasoning": "Some suspicious patterns found.",
  "indicators": [`;

    const env = makeMockEnv(truncated);
    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Suspicious');
    expect(result.confidence).toBe(60);
    expect(result.indicators).toEqual([]);
  });

  it('repairs JSON missing closing brace', async () => {
    const truncated = `{"verdict":"Safe","confidence":10,"reasoning":"Looks fine.","indicators":[]`;

    const env = makeMockEnv(truncated);
    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Safe');
    expect(result.confidence).toBe(10);
  });

  it('repairs JSON with trailing comma in indicators', async () => {
    const truncated = `{
  "verdict": "Phishing",
  "confidence": 90,
  "reasoning": "Bad.",
  "indicators": [
    {"type": "suspicious_url", "detail": "fake link", "severity": "critical"},
  ]
}`;

    const env = makeMockEnv(truncated);
    // Trailing comma in array is invalid JSON — but our regex-based extraction
    // + repair should handle it
    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Phishing');
  });

  it('handles complete valid JSON without modification', async () => {
    const valid = '{"verdict":"Safe","confidence":5,"reasoning":"Normal email.","indicators":[{"type":"legitimate_sender","detail":"Known domain","severity":"low"}]}';
    const env = makeMockEnv(valid);
    const result = await getVerdict(env, 'test');
    expect(result.verdict).toBe('Safe');
    expect(result.confidence).toBe(5);
    expect(result.indicators).toHaveLength(1);
  });
});
