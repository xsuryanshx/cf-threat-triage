import type { Env, Triage, TriageStats, ThreatIndicator } from '../types';

export async function insertTriage(
  env: Env,
  data: {
    email_text: string;
    sender_domain: string | null;
    verdict: Triage['verdict'];
    confidence: number;
    reasoning: string;
    indicators: ThreatIndicator[];
  }
): Promise<number> {
  const result = await env.DB.prepare(
    'INSERT INTO triages (email_text, sender_domain, verdict, confidence, reasoning, indicators, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      data.email_text,
      data.sender_domain,
      data.verdict,
      data.confidence,
      data.reasoning,
      JSON.stringify(data.indicators),
      new Date().toISOString()
    )
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
  const safeIds = ids.slice(0, 50);
  const placeholders = safeIds.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT * FROM triages WHERE id IN (${placeholders})`
  )
    .bind(...safeIds)
    .all<Triage>();
  return result.results;
}

export async function getStats(env: Env): Promise<TriageStats> {
  const [totals, domains, activity] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN verdict = 'Safe' THEN 1 ELSE 0 END) as safe,
        SUM(CASE WHEN verdict = 'Suspicious' THEN 1 ELSE 0 END) as suspicious,
        SUM(CASE WHEN verdict = 'Phishing' THEN 1 ELSE 0 END) as phishing
      FROM triages
    `).first<{ total: number; safe: number; suspicious: number; phishing: number }>(),

    env.DB.prepare(`
      SELECT
        sender_domain as domain,
        COUNT(*) as count,
        SUM(CASE WHEN verdict = 'Phishing' THEN 1 ELSE 0 END) as phishing_count
      FROM triages
      WHERE sender_domain IS NOT NULL
      GROUP BY sender_domain
      ORDER BY phishing_count DESC, count DESC
      LIMIT 10
    `).all<{ domain: string; count: number; phishing_count: number }>(),

    env.DB.prepare(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM triages
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all<{ date: string; count: number }>(),
  ]);

  return {
    total: totals?.total ?? 0,
    safe: totals?.safe ?? 0,
    suspicious: totals?.suspicious ?? 0,
    phishing: totals?.phishing ?? 0,
    topDomains: domains.results,
    recentActivity: activity.results,
  };
}
