CREATE TABLE IF NOT EXISTS triages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_text TEXT NOT NULL,
  sender_domain TEXT,
  verdict TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50,
  reasoning TEXT NOT NULL,
  indicators TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_triages_sender_domain ON triages(sender_domain);
CREATE INDEX IF NOT EXISTS idx_triages_verdict ON triages(verdict);
CREATE INDEX IF NOT EXISTS idx_triages_created_at ON triages(created_at DESC);
