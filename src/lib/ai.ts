import type { Env } from '../types';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5' as const;
const VERDICT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as const;

export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run(EMBEDDING_MODEL, { text }) as { data: number[][] };
  if (!result?.data?.[0]) throw new Error('Embedding model returned empty result');
  return result.data[0];
}

export async function getVerdict(
  env: Env,
  prompt: string
): Promise<{ verdict: 'Safe' | 'Suspicious' | 'Phishing'; reasoning: string }> {
  const result = await env.AI.run(VERDICT_MODEL, {
    messages: [{ role: 'user', content: prompt }],
  }) as { response: string };

  if (!result || typeof result.response !== 'string') {
    throw new Error('LLM did not return valid JSON');
  }

  const jsonMatch = result.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON');

  let parsed: { verdict?: string; reasoning?: string };
  try {
    parsed = JSON.parse(jsonMatch[0]) as { verdict?: string; reasoning?: string };
  } catch {
    throw new Error('LLM did not return valid JSON');
  }

  if (parsed.verdict == null || parsed.reasoning == null) {
    throw new Error('LLM response missing required fields');
  }
  if (!['Safe', 'Suspicious', 'Phishing'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`);
  }

  return {
    verdict: parsed.verdict as 'Safe' | 'Suspicious' | 'Phishing',
    reasoning: parsed.reasoning,
  };
}
