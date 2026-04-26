export interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

export interface ThreatIndicator {
  type: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface Triage {
  id: number;
  email_text: string;
  sender_domain: string | null;
  verdict: 'Safe' | 'Suspicious' | 'Phishing';
  confidence: number;
  reasoning: string;
  indicators: string; // JSON string of ThreatIndicator[]
  created_at: string;
}

export interface TriageStats {
  total: number;
  safe: number;
  suspicious: number;
  phishing: number;
  topDomains: { domain: string; count: number; phishing_count: number }[];
  recentActivity: { date: string; count: number }[];
}
