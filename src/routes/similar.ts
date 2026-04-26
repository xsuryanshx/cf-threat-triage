import type { Env, Triage } from '../types';
import { getEmbedding } from '../lib/ai';
import { getTriagesByIds } from '../lib/db';

export async function handleSimilar(request: Request, env: Env): Promise<Response> {
  let body: { emailText?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { emailText } = body;
  if (!emailText || emailText.trim().length < 1) {
    return Response.json({ error: 'emailText is required' }, { status: 400 });
  }

  const embedding = await getEmbedding(env, emailText);
  const vectorResults = await env.VECTORIZE.query(embedding, { topK: 5, returnMetadata: 'all' });

  if (vectorResults.matches.length === 0) {
    return Response.json([]);
  }

  const ids = vectorResults.matches
    .map((m) => Number(m.metadata?.triage_id))
    .filter((id) => Number.isFinite(id));
  const triages = await getTriagesByIds(env, ids);

  const result = vectorResults.matches
    .map((m) => {
      const triage = triages.find((t) => t.id === Number(m.metadata?.triage_id));
      return triage ? { ...triage, score: m.score } : null;
    })
    .filter(Boolean) as (Triage & { score: number })[];

  return Response.json(result);
}
