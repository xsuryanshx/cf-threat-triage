CREATE TABLE IF NOT EXISTS triages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_text TEXT NOT NULL,
  sender_domain TEXT,
  verdict TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  created_at TEXT NOT NULL
);
