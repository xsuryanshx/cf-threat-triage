import type { Env } from '../types';
import { getStats } from '../lib/db';

export async function handleStats(_request: Request, env: Env): Promise<Response> {
  try {
    const stats = await getStats(env);
    return Response.json(stats);
  } catch (e) {
    console.error('[stats] failed:', e);
    return Response.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
