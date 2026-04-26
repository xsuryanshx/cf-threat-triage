import { handleAnalyze } from './routes/analyze';
import { handleHistory } from './routes/history';
import { handleSimilar } from './routes/similar';
import { handleStats } from './routes/stats';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // CORS headers for local dev
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (pathname === '/api/analyze' && method === 'POST') {
      return handleAnalyze(request, env);
    }
    if (pathname === '/api/history' && method === 'GET') {
      return handleHistory(request, env);
    }
    if (pathname === '/api/similar' && method === 'POST') {
      return handleSimilar(request, env);
    }
    if (pathname === '/api/stats' && method === 'GET') {
      return handleStats(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};
