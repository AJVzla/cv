-- Base del chat del CV (Cloudflare D1).
-- Se aplica con: npx wrangler d1 execute cv-chat --remote --file=schema.sql

-- Conversaciones en las que respondés vos (la IA se pausa hasta human_until).
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  human_until INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

-- Tus respuestas desde Telegram, esperando que el chat del visitante las muestre.
CREATE TABLE IF NOT EXISTS replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session    TEXT    NOT NULL,
  content    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replies_session ON replies (session, id);
