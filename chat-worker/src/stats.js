/*
 * Métricas propias del sitio: descargas del PDF y conversaciones nuevas en el chat.
 * Se guardan agregadas por día (sin IP ni datos del visitante).
 * La tabla se crea sola la primera vez; también está en schema.sql.
 */

export const EVENT_TYPES = {
  pdf: "📄 Descargaron tu CV en PDF",
};

const LABELS = {
  pdf: "📄 Descargas del PDF",
  chat: "💬 Conversaciones nuevas en el chat",
};

const CREATE = `CREATE TABLE IF NOT EXISTS events (
  day  TEXT    NOT NULL,
  type TEXT    NOT NULL,
  lang TEXT    NOT NULL DEFAULT 'es',
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type, lang)
)`;

const offsetMs = env => (Number(env.HEALTH_TZ_OFFSET_MIN) || -180) * 60_000;

export function localDay(env, t = Date.now()) {
  return new Date(t + offsetMs(env)).toISOString().slice(0, 10);
}

export async function countEvent(env, type, lang) {
  if (!env.DB || !(type in LABELS)) return 0;
  const day = localDay(env);
  const l = lang === "en" ? "en" : "es";
  await env.DB.batch([
    env.DB.prepare(CREATE),
    env.DB.prepare(
      "INSERT INTO events (day, type, lang, n) VALUES (?1, ?2, ?3, 1) " +
      "ON CONFLICT (day, type, lang) DO UPDATE SET n = n + 1"
    ).bind(day, type, l),
  ]);
  return 1;
}

export async function statsText(env) {
  if (!env.DB) return "No hay base de datos configurada.";
  const since30 = localDay(env, Date.now() - 29 * 86_400_000);
  const since7 = localDay(env, Date.now() - 6 * 86_400_000);
  const today = localDay(env);
  await env.DB.prepare(CREATE).run();
  const { results } = await env.DB.prepare(
    `SELECT type,
            SUM(CASE WHEN day = ?3 THEN n ELSE 0 END) AS today,
            SUM(CASE WHEN day >= ?2 THEN n ELSE 0 END) AS d7,
            SUM(n) AS d30,
            SUM(CASE WHEN lang = 'en' THEN n ELSE 0 END) AS en30
       FROM events WHERE day >= ?1 GROUP BY type`
  ).bind(since30, since7, today).all();

  const byType = Object.fromEntries((results || []).map(r => [r.type, r]));
  const lines = ["<b>📊 Tu CV en números</b>", ""];
  for (const [type, label] of Object.entries(LABELS)) {
    const r = byType[type] || { today: 0, d7: 0, d30: 0, en30: 0 };
    lines.push(`${label}`);
    lines.push(`Hoy: ${r.today} · 7 días: ${r.d7} · 30 días: ${r.d30}` + (r.d30 ? ` (en inglés: ${r.en30})` : ""));
    lines.push("");
  }
  lines.push("<i>Las visitas y de dónde llegan están en Cloudflare → Web Analytics.</i>");
  return lines.join("\n");
}
