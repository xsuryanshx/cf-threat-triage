import { handleAnalyze } from './routes/analyze';
import { handleHistory } from './routes/history';
import { handleSimilar } from './routes/similar';
import { handleStats } from './routes/stats';
import type { Env } from './types';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Attach CORS headers to every response so browser extensions can call the API. */
function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    let response: Response;

    if (pathname === '/api/analyze' && method === 'POST') {
      response = await handleAnalyze(request, env);
    } else if (pathname === '/api/history' && method === 'GET') {
      response = await handleHistory(request, env);
    } else if (pathname === '/api/similar' && method === 'POST') {
      response = await handleSimilar(request, env);
    } else if (pathname === '/api/stats' && method === 'GET') {
      response = await handleStats(request, env);
    } else {
      response = new Response('Not Found', { status: 404 });
    }

    return withCors(response);
  },
};
