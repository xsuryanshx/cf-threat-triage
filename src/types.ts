export interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
}

export interface Triage {
  id: number;
  email_text: string;
  sender_domain: string | null;
  verdict: 'Safe' | 'Suspicious' | 'Phishing';
  reasoning: string;
  created_at: string;
}
