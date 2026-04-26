import type { Env, Triage } from '../types';

export async function insertTriage(
  env: Env,
  data: { email_text: string; sender_domain: string | null; verdict: string; reasoning: string }
): Promise<number> {
  const result = await env.DB.prepare(
    'INSERT INTO triages (email_text, sender_domain, verdict, reasoning, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(data.email_text, data.sender_domain, data.verdict, data.reasoning, new Date().toISOString())
    .run();
  return result.meta.last_row_id as number;
}

export async function getTriagesByDomain(env: Env, domain: string): Promise<Triage[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM triages WHERE sender_domain = ? ORDER BY created_at DESC LIMIT 5'
  )
    .bind(domain)
    .all<Triage>();
  return result.results;
}

export async function getAllTriages(env: Env, limit: number = 50): Promise<Triage[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM triages ORDER BY created_at DESC LIMIT ?'
  )
    .bind(limit)
    .all<Triage>();
  return result.results;
}

export async function getTriagesByIds(env: Env, ids: number[]): Promise<Triage[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT * FROM triages WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all<Triage>();
  return result.results;
}
