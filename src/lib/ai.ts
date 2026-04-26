import type { Env } from '../types';

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5' as const;
const VERDICT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as const;

export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const result = await env.AI.run(EMBEDDING_MODEL, { text }) as { data: number[][] };
  return result.data[0];
}

export async function getVerdict(
  env: Env,
  prompt: string
): Promise<{ verdict: string; reasoning: string }> {
  const result = await env.AI.run(VERDICT_MODEL, {
    messages: [{ role: 'user', content: prompt }],
  }) as { response: string };

  const jsonMatch = result.response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]) as { verdict?: string; reasoning?: string };
  if (!parsed.verdict || !parsed.reasoning) {
    throw new Error('LLM response missing required fields');
  }
  if (!['Safe', 'Suspicious', 'Phishing'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`);
  }

  return { verdict: parsed.verdict, reasoning: parsed.reasoning };
}
