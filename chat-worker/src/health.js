/*
 * Estado físico: recibe datos de Health Connect (app HC Webhook) y los resume para /estado-fisico.
 *
 * POST /health/ingest   Lo llama la app HC Webhook. Requiere el encabezado x-api-key = HEALTH_INGEST_KEY.
 * GET  /health/summary  Lo lee la página. Devuelve solo resúmenes por día (sin horarios exactos de sueño).
 *
 * Solo se guardan: actividad (pasos, distancia, calorías activas), entrenamientos,
 * corazón (pulso, pulso en reposo, VO2 máx) y sueño. Todo lo demás que mande la app se ignora.
 *
 * Límites de D1 en el plan gratis: 50 consultas por invocación y 100 parámetros por consulta.
 * Por eso los números se validan y se escriben en lote (cientos de filas por sentencia).
 */

const DAY_MS = 86_400_000;
const KEEP_HR_DAYS = 40;              // pulso minuto a minuto: se borra lo más viejo
const MAX_STATEMENT_BYTES = 90_000;   // D1 acepta sentencias de hasta 100 KB

// Constantes oficiales de Health Connect (androidx ExerciseSessionRecord)
const EXERCISE = {
  0: ["Entrenamiento", "Workout"], 2: ["Bádminton", "Badminton"], 4: ["Béisbol", "Baseball"], 5: ["Básquet", "Basketball"],
  8: ["Bici", "Cycling"], 9: ["Bici fija", "Indoor cycling"], 10: ["Bootcamp", "Bootcamp"], 11: ["Boxeo", "Boxing"],
  13: ["Calistenia", "Calisthenics"], 14: ["Críquet", "Cricket"], 16: ["Baile", "Dancing"], 25: ["Elíptica", "Elliptical"],
  26: ["Clase de ejercicio", "Exercise class"], 27: ["Esgrima", "Fencing"], 28: ["Fútbol americano", "American football"],
  29: ["Fútbol australiano", "Australian football"], 31: ["Frisbee", "Frisbee"], 32: ["Golf", "Golf"],
  33: ["Respiración guiada", "Guided breathing"], 34: ["Gimnasia", "Gymnastics"], 35: ["Handball", "Handball"],
  36: ["HIIT", "HIIT"], 37: ["Trekking", "Hiking"], 38: ["Hockey sobre hielo", "Ice hockey"], 39: ["Patinaje sobre hielo", "Ice skating"],
  44: ["Artes marciales", "Martial arts"], 46: ["Remo / kayak", "Paddling"], 47: ["Parapente", "Paragliding"], 48: ["Pilates", "Pilates"],
  50: ["Ráquetbol", "Racquetball"], 51: ["Escalada", "Rock climbing"], 52: ["Hockey sobre patines", "Roller hockey"], 53: ["Remo", "Rowing"],
  54: ["Remo en máquina", "Rowing machine"], 55: ["Rugby", "Rugby"], 56: ["Correr", "Running"], 57: ["Cinta", "Treadmill"],
  58: ["Vela", "Sailing"], 59: ["Buceo", "Scuba diving"], 60: ["Patinaje", "Skating"], 61: ["Esquí", "Skiing"], 62: ["Snowboard", "Snowboarding"],
  63: ["Raquetas de nieve", "Snowshoeing"], 64: ["Fútbol", "Soccer"], 65: ["Softball", "Softball"], 66: ["Squash", "Squash"],
  68: ["Escaleras", "Stair climbing"], 69: ["Escaladora", "Stair machine"], 70: ["Fuerza", "Strength training"], 71: ["Elongación", "Stretching"],
  72: ["Surf", "Surfing"], 73: ["Natación en aguas abiertas", "Open water swimming"], 74: ["Natación", "Pool swimming"],
  75: ["Ping pong", "Table tennis"], 76: ["Tenis", "Tennis"], 78: ["Vóley", "Volleyball"], 79: ["Caminata", "Walking"],
  80: ["Waterpolo", "Water polo"], 81: ["Pesas", "Weightlifting"], 82: ["Silla de ruedas", "Wheelchair"], 83: ["Yoga", "Yoga"],
};
// androidx SleepSessionRecord: 1 despierto, 2 dormido, 3 fuera de la cama, 4 liviano, 5 profundo, 6 REM, 7 despierto en la cama
const SLEEP_STAGE = { 1: "awake", 3: "awake", 7: "awake", 4: "light", 2: "light", 5: "deep", 6: "rem" };

/* ---------------- utilidades ---------------- */

const ms = iso => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const num = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
const tzOffsetMs = env => (Number(env.HEALTH_TZ_OFFSET_MIN ?? -180) || 0) * 60_000;   // Buenos Aires: UTC-3
const dayOf = (t, env) => new Date(t + tzOffsetMs(env)).toISOString().slice(0, 10);
const round = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });

// Escribe filas numéricas en lote. Los valores ya pasaron por num()/ms(), así que son números finitos o null.
function bulkUpsert(table, cols, rows, conflict, update) {
  const head = `INSERT INTO ${table} (${cols.join(",")}) VALUES `;
  const tail = ` ON CONFLICT(${conflict}) DO UPDATE SET ${update}`;
  const stmts = [];
  let values = [], size = head.length + tail.length;
  for (const r of rows) {
    const v = "(" + r.map(x => (x == null ? "NULL" : String(x))).join(",") + ")";
    if (values.length && size + v.length + 1 > MAX_STATEMENT_BYTES) {
      stmts.push(head + values.join(",") + tail);
      values = []; size = head.length + tail.length;
    }
    values.push(v); size += v.length + 1;
  }
  if (values.length) stmts.push(head + values.join(",") + tail);
  return stmts;
}

/* ---------------- ingest ---------------- */

export function parsePayload(p) {
  const out = { buckets: [], hr: [], points: [], sleep: [], exercise: [], deleted: [] };
  if (!p || typeof p !== "object") return out;
  const arr = k => (Array.isArray(p[k]) ? p[k] : []);

  // Actividad: pasos, distancia y calorías activas, por intervalo (diario o por bloques)
  for (const [key, field, type] of [["steps", "count", "steps"], ["distance", "meters", "distance"], ["active_calories", "calories", "active_calories"]]) {
    for (const r of arr(key)) {
      const s = ms(r.start_time), e = ms(r.end_time), v = num(r[field]);
      if (s != null && e != null && v != null && v >= 0) out.buckets.push({ type, s, e, v });
    }
  }
  // Pulso: muestra (bpm) o bloque (avg/min/max)
  for (const r of arr("heart_rate")) {
    const t = ms(r.time);
    const avg = num(r.avg) ?? num(r.bpm);
    if (t == null || avg == null || avg < 25 || avg > 240) continue;
    out.hr.push({ t, avg, min: num(r.min) ?? avg, max: num(r.max) ?? avg });
  }
  for (const r of arr("resting_heart_rate")) {
    const t = ms(r.time), v = num(r.bpm);
    if (t != null && v != null && v > 25 && v < 150) out.points.push({ type: "resting_hr", t, v, id: r.metadata?.id });
  }
  for (const r of arr("vo2_max")) {
    const t = ms(r.time), v = num(r.ml_per_kg_per_min);
    if (t != null && v != null && v > 5 && v < 100) out.points.push({ type: "vo2max", t, v, id: r.metadata?.id });
  }
  // Sueño: solo duración por etapa
  for (const r of arr("sleep")) {
    const end = ms(r.session_end_time), dur = num(r.duration_seconds);
    if (end == null || dur == null || dur <= 0 || dur > 24 * 3600) continue;
    const st = { light: 0, deep: 0, rem: 0, awake: 0 };
    for (const s of Array.isArray(r.stages) ? r.stages : []) {
      const k = SLEEP_STAGE[parseInt(s.stage, 10)];
      const d = num(s.duration_seconds);
      if (k && d != null && d > 0) st[k] += d;
    }
    out.sleep.push({ id: String(r.metadata?.id || "end:" + end).slice(0, 120), end, dur, ...st });
  }
  // Entrenamientos
  for (const r of arr("exercise")) {
    const s = ms(r.start_time), e = ms(r.end_time), dur = num(r.duration_seconds);
    if (s == null || e == null || dur == null || dur <= 0) continue;
    out.exercise.push({
      id: String(r.metadata?.id || "start:" + s).slice(0, 120),
      type: parseInt(r.type, 10), s, e, dur,
      dist: num(r.distance_meters), steps: num(r.steps),
      title: typeof r.title === "string" ? r.title.slice(0, 60) : null,
    });
  }
  for (const d of arr("deleted")) {
    if (d && typeof d.id === "string" && ["exercise", "sleep", "resting_heart_rate", "vo2_max"].includes(d.type)) out.deleted.push(d);
  }
  return out;
}

export async function handleIngest(request, env) {
  if (!env.HEALTH_INGEST_KEY || request.headers.get("x-api-key") !== env.HEALTH_INGEST_KEY) return json({ error: "unauthorized" }, 401);
  if (!env.DB) return json({ error: "no_database" }, 500);
  const payload = await request.json().catch(() => null);
  if (!payload) return json({ error: "bad_request" }, 400);

  const d = parsePayload(payload);
  const stmts = [];

  stmts.push(...bulkUpsert("health_buckets", ["type", "start_time", "end_time", "value"],
    d.buckets.map(b => [`'${b.type}'`, b.s, b.e, b.v]), "type, start_time", "end_time = excluded.end_time, value = excluded.value")
    .map(sql => env.DB.prepare(sql)));
  stmts.push(...bulkUpsert("health_hr", ["time", "avg", "min", "max"], d.hr.map(h => [h.t, h.avg, h.min, h.max]),
    "time", "avg = excluded.avg, min = excluded.min, max = excluded.max").map(sql => env.DB.prepare(sql)));

  for (const pt of d.points) {
    stmts.push(env.DB.prepare("INSERT INTO health_points (type, time, value, id) VALUES (?, ?, ?, ?) ON CONFLICT(type, time) DO UPDATE SET value = excluded.value, id = excluded.id")
      .bind(pt.type, pt.t, pt.v, pt.id || null));
  }
  for (const s of d.sleep) {
    stmts.push(env.DB.prepare("INSERT INTO health_sleep (id, end_time, duration_s, light_s, deep_s, rem_s, awake_s) VALUES (?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET end_time = excluded.end_time, duration_s = excluded.duration_s, light_s = excluded.light_s, deep_s = excluded.deep_s, rem_s = excluded.rem_s, awake_s = excluded.awake_s")
      .bind(s.id, s.end, s.dur, s.light, s.deep, s.rem, s.awake));
  }
  for (const x of d.exercise) {
    stmts.push(env.DB.prepare("INSERT INTO health_exercise (id, type, start_time, end_time, duration_s, distance_m, steps, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET type = excluded.type, start_time = excluded.start_time, end_time = excluded.end_time, duration_s = excluded.duration_s, distance_m = excluded.distance_m, steps = excluded.steps, title = excluded.title")
      .bind(x.id, Number.isFinite(x.type) ? x.type : 0, x.s, x.e, x.dur, x.dist, x.steps, x.title));
  }
  for (const del of d.deleted) {
    const table = { exercise: "health_exercise", sleep: "health_sleep" }[del.type];
    if (table) stmts.push(env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(del.id));
    else stmts.push(env.DB.prepare("DELETE FROM health_points WHERE id = ?").bind(del.id));
  }
  stmts.push(env.DB.prepare("DELETE FROM health_hr WHERE time < ?").bind(Date.now() - KEEP_HR_DAYS * DAY_MS));
  stmts.push(env.DB.prepare("INSERT INTO health_meta (key, value) VALUES ('last_ingest', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(Date.now())));

  // batch = una sola ida y vuelta a D1, y todo o nada
  if (stmts.length > 45) return json({ error: "payload_too_large", hint: "Bajá la resolución del pulso en la app (5 minutos)." }, 413);
  await env.DB.batch(stmts);

  return json({
    ok: true,
    stored: { activity: d.buckets.length, heart_rate: d.hr.length, points: d.points.length, sleep: d.sleep.length, exercise: d.exercise.length, deleted: d.deleted.length },
  }, 200);
}

/* ---------------- resumen para la página ---------------- */

export async function handleSummary(env, lang, headers) {
  const empty = { updated_at: null, days: [], today: null, heart: {}, sleep: [], workouts: [] };
  if (!env.DB) return json(empty, 200, headers);

  const DAYS = 30;
  const now = Date.now();
  const since = now - (DAYS + 1) * DAY_MS;
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then(r => r.results || []);

  const [buckets, hrDaily, lastPulse, points, sleeps, workouts, meta] = await Promise.all([
    q("SELECT type, start_time, end_time, value FROM health_buckets WHERE end_time >= ?", since),
    q("SELECT time, avg, min, max FROM health_hr WHERE time >= ?", since),
    q("SELECT time, avg FROM health_hr ORDER BY time DESC LIMIT 1"),
    q("SELECT type, time, value FROM health_points WHERE time >= ? ORDER BY time", now - 120 * DAY_MS),
    q("SELECT end_time, duration_s, light_s, deep_s, rem_s, awake_s FROM health_sleep WHERE end_time >= ? ORDER BY end_time", since),
    q("SELECT id, type, start_time, end_time, duration_s, distance_m, steps, title FROM health_exercise ORDER BY start_time DESC LIMIT 20"),
    q("SELECT value FROM health_meta WHERE key = 'last_ingest'"),
  ]);

  // Días: últimos 30, del más viejo al más nuevo
  const days = new Map();
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = dayOf(now - i * DAY_MS, env);
    days.set(date, { date, steps: 0, distance_km: 0, active_kcal: 0, sleep_h: null, hr_avg: null, hr_min: null, hr_max: null, resting_bpm: null, workouts: 0 });
  }
  for (const b of buckets) {
    const day = days.get(dayOf((b.start_time + b.end_time) / 2, env));
    if (!day) continue;
    if (b.type === "steps") day.steps += b.value;
    if (b.type === "distance") day.distance_km += b.value / 1000;
    if (b.type === "active_calories") day.active_kcal += b.value;
  }
  const hrAcc = new Map();
  for (const h of hrDaily) {
    const date = dayOf(h.time, env);
    const a = hrAcc.get(date) || { sum: 0, n: 0, min: Infinity, max: -Infinity };
    a.sum += h.avg; a.n++; a.min = Math.min(a.min, h.min); a.max = Math.max(a.max, h.max);
    hrAcc.set(date, a);
  }
  for (const [date, a] of hrAcc) {
    const day = days.get(date);
    if (day) Object.assign(day, { hr_avg: round(a.sum / a.n), hr_min: round(a.min), hr_max: round(a.max) });
  }
  for (const p of points.filter(p => p.type === "resting_hr")) {
    const day = days.get(dayOf(p.time, env));
    if (day) day.resting_bpm = round(p.value);
  }
  const sleepNights = sleeps.map(s => ({
    date: dayOf(s.end_time, env),           // la noche se anota en el día en que te despertás
    hours: round(s.duration_s / 3600, 1),
    light_h: round(s.light_s / 3600, 1), deep_h: round(s.deep_s / 3600, 1), rem_h: round(s.rem_s / 3600, 1), awake_h: round(s.awake_s / 3600, 1),
  }));
  const sleepByDay = new Map();
  for (const n of sleepNights) sleepByDay.set(n.date, round((sleepByDay.get(n.date) || 0) + n.hours, 1));
  for (const [date, h] of sleepByDay) { const day = days.get(date); if (day) day.sleep_h = h; }

  // Entrenamientos con pulso promedio (de los bloques de pulso dentro de la sesión)
  const li = lang === "en" ? 1 : 0;
  const workoutList = [];
  for (const w of workouts) {
    const inside = hrDaily.filter(h => h.time >= w.start_time && h.time <= w.end_time);
    const avg = inside.length ? round(inside.reduce((s, h) => s + h.avg, 0) / inside.length) : null;
    const date = dayOf(w.start_time, env);
    const day = days.get(date); if (day) day.workouts++;
    workoutList.push({
      date, type: w.type, name: (EXERCISE[w.type] || EXERCISE[0])[li], title: w.title || null,
      duration_min: round(w.duration_s / 60), distance_km: w.distance_m ? round(w.distance_m / 1000, 2) : null,
      steps: w.steps, avg_bpm: avg,
      pace_min_km: w.distance_m > 300 && [56, 57, 79, 37].includes(w.type) ? round(w.duration_s / 60 / (w.distance_m / 1000), 2) : null,
    });
  }

  const dayList = [...days.values()].map(d => ({ ...d, steps: Math.round(d.steps), distance_km: round(d.distance_km, 2), active_kcal: Math.round(d.active_kcal) }));
  const latest = type => { const l = points.filter(p => p.type === type).pop(); return l ? { value: round(l.value, 1), date: dayOf(l.time, env) } : null; };
  const pulse = lastPulse[0];

  return json({
    updated_at: meta[0] ? Number(meta[0].value) : null,
    today: dayList[dayList.length - 1],
    days: dayList,
    heart: {
      last_bpm: pulse ? round(pulse.avg) : null,
      last_minutes_ago: pulse ? Math.max(0, Math.round((now - pulse.time) / 60_000)) : null,
      resting: latest("resting_hr"),
      vo2max: latest("vo2max"),
    },
    sleep: sleepNights.slice(-14),
    workouts: workoutList,
  }, 200, { ...headers, "Cache-Control": "private, no-store" });
}
