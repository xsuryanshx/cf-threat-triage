import type { Env, ThreatIndicator } from '../types';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5' as const;

const VERDICT_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-70b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
] as const;

export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run(EMBEDDING_MODEL, { text }) as { data: number[][] };
  if (!result?.data?.[0]) throw new Error('Embedding model returned empty result');
  return result.data[0];
}

export interface VerdictResult {
  verdict: 'Safe' | 'Suspicious' | 'Phishing';
  confidence: number;
  reasoning: string;
  indicators: ThreatIndicator[];
}

export async function getVerdict(env: Env, prompt: string): Promise<VerdictResult> {
  let lastError: Error | null = null;

  for (const model of VERDICT_MODELS) {
    try {
      console.log(`[ai] Trying model: ${model}`);
      const result = await env.AI.run(model as any, {
        messages: [
          { role: 'system', content: 'You are a cybersecurity expert. Respond with ONLY a valid JSON object. No markdown. No code fences. Keep responses concise — under 500 tokens.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
      }) as { response?: string } | null;

      if (!result || typeof result.response !== 'string' || !result.response.trim()) {
        console.error(`[ai] Model ${model} returned empty/invalid result`);
        continue;
      }

      console.log(`[ai] Model ${model} response (${result.response.length} chars):`, result.response.slice(0, 300));
      return parseVerdictResponse(result.response);
    } catch (e) {
      console.error(`[ai] Model ${model} failed:`, e);
      lastError = e as Error;
    }
  }

  throw lastError || new Error('All AI models failed');
}

/**
 * Attempts to repair truncated JSON from LLMs that hit token limits.
 * The structure is known: { verdict, confidence, reasoning, indicators: [...] }
 * If the JSON is cut off mid-indicators array, we close the open brackets.
 */
function repairTruncatedJson(raw: string): string {
  // Try parsing as-is first
  try {
    JSON.parse(raw);
    return raw;
  } catch { /* needs repair */ }

  let repaired = raw.trim();

  // Remove any trailing incomplete string (cut off mid-value)
  // Find the last complete key-value or array element
  repaired = repaired.replace(/,\s*"[^"]*$/, ''); // trailing incomplete key
  repaired = repaired.replace(/,\s*\{[^}]*$/, ''); // trailing incomplete object in array
  repaired = repaired.replace(/,\s*$/, '');         // trailing comma

  // Remove trailing commas before closing brackets (invalid JSON but common LLM output)
  repaired = repaired.replace(/,\s*([\]\}])/g, '$1');

  // Count open brackets and close them
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of repaired) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }

  // Close any unclosed brackets/braces
  while (brackets > 0) { repaired += ']'; brackets--; }
  while (braces > 0) { repaired += '}'; braces--; }

  return repaired;
}

function parseVerdictResponse(raw: string): VerdictResult {
  // Strip markdown code fences
  let cleaned = raw
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  // Repair truncated JSON before trying to extract (regex needs closing brace)
  cleaned = repairTruncatedJson(cleaned);

  // Extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM did not return valid JSON. Got: ${cleaned.slice(0, 200)}`);
  }

  const jsonStr = jsonMatch[0];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${(e as Error).message}. Raw: ${jsonStr.slice(0, 200)}`);
  }

  const verdict = parsed.verdict as string;
  if (!verdict || !['Safe', 'Suspicious', 'Phishing'].includes(verdict)) {
    throw new Error(`Invalid verdict: ${verdict}`);
  }

  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided.';
  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(100, Math.max(0, Math.round(parsed.confidence)))
    : (verdict === 'Safe' ? 20 : verdict === 'Suspicious' ? 55 : 85);

  let indicators: ThreatIndicator[] = [];
  if (Array.isArray(parsed.indicators)) {
    indicators = parsed.indicators
      .filter((i: unknown): i is Record<string, string> =>
        typeof i === 'object' && i !== null && 'type' in i && 'detail' in i
      )
      .map((i) => ({
        type: String(i.type),
        detail: String(i.detail),
        severity: (['critical', 'high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium') as ThreatIndicator['severity'],
      }))
      .slice(0, 10);
  }

  return {
    verdict: verdict as VerdictResult['verdict'],
    confidence,
    reasoning,
    indicators,
  };
}
