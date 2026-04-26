import type { Env } from '../types';
import { getAllTriages } from '../lib/db';

export async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200);

  const triages = await getAllTriages(env, limit);
  return Response.json(triages);
}
