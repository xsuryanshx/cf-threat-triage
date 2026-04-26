import type { Env, Triage } from '../types';
import { getAllTriages } from '../lib/db';

export async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  // Clamp to [1, 200]: negative values would bypass the cap (SQLite LIMIT -n = no limit)
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);

  let triages: Triage[];
  try {
    triages = await getAllTriages(env, limit);
  } catch {
    return Response.json({ error: 'Failed to load history' }, { status: 500 });
  }

  return Response.json(triages);
}
