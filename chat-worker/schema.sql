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

-- ---------- Estado físico (Health Connect vía HC Webhook) ----------

-- Pasos, distancia y calorías activas por intervalo (diario o por bloques).
CREATE TABLE IF NOT EXISTS health_buckets (
  type       TEXT    NOT NULL,       -- steps | distance | active_calories
  start_time INTEGER NOT NULL,       -- ms
  end_time   INTEGER NOT NULL,
  value      REAL    NOT NULL,
  PRIMARY KEY (type, start_time)
);
CREATE INDEX IF NOT EXISTS idx_health_buckets_end ON health_buckets (end_time);

-- Pulso por bloques (se guardan 40 días).
CREATE TABLE IF NOT EXISTS health_hr (
  time INTEGER PRIMARY KEY,          -- ms, inicio del bloque
  avg  REAL NOT NULL,
  min  REAL NOT NULL,
  max  REAL NOT NULL
);

-- Mediciones sueltas: pulso en reposo, VO2 máx.
CREATE TABLE IF NOT EXISTS health_points (
  type  TEXT    NOT NULL,            -- resting_hr | vo2max | bp_sys | bp_dia | spo2 | spo2_min
  time  INTEGER NOT NULL,
  value REAL    NOT NULL,
  id    TEXT,
  PRIMARY KEY (type, time)
);

-- Sesiones de sueño (solo duraciones, la página no muestra horarios).
CREATE TABLE IF NOT EXISTS health_sleep (
  id         TEXT PRIMARY KEY,
  end_time   INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  light_s    INTEGER NOT NULL DEFAULT 0,
  deep_s     INTEGER NOT NULL DEFAULT 0,
  rem_s      INTEGER NOT NULL DEFAULT 0,
  awake_s    INTEGER NOT NULL DEFAULT 0
);

-- Entrenamientos.
CREATE TABLE IF NOT EXISTS health_exercise (
  id         TEXT PRIMARY KEY,
  type       INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time   INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  distance_m REAL,
  steps      INTEGER,
  title      TEXT
);
CREATE INDEX IF NOT EXISTS idx_health_exercise_start ON health_exercise (start_time);

CREATE TABLE IF NOT EXISTS health_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ---------- Métricas del sitio ----------

-- Descargas del PDF y conversaciones nuevas, agregadas por día (sin datos del visitante).
-- El Worker la crea solo si no existe.
CREATE TABLE IF NOT EXISTS events (
  day  TEXT    NOT NULL,             -- YYYY-MM-DD en hora de Buenos Aires
  type TEXT    NOT NULL,             -- pdf | chat
  lang TEXT    NOT NULL DEFAULT 'es',
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type, lang)
);

-- ---------- Roadmap de Salesforce (Trailhead) ----------
-- El Worker las crea solo si no existen.
CREATE TABLE IF NOT EXISTS trailhead_badges (
  path       TEXT PRIMARY KEY,   -- modules/prompt-fundamentals
  title      TEXT NOT NULL,
  type       TEXT,
  icon       TEXT,
  first_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trailhead_meta (key TEXT PRIMARY KEY, value TEXT);
