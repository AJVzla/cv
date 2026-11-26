/*
 * Insignias de Trailhead para /roadmap-salesforce-specialist/.
 *
 * Trailhead no tiene una API oficial para esto. Se usa el mismo servicio GraphQL público
 * que carga la página de perfil (profile.api.trailhead.com). Si un día cambia, la página
 * sigue mostrando la última copia guardada y te llega un aviso por Telegram.
 *
 * Cada hora (Cron Trigger) se consulta el perfil y se guardan las insignias y certificaciones.
 * GET /trailhead devuelve la copia guardada (datos públicos del perfil).
 * En Telegram, /trailhead fuerza una actualización.
 */

const ENDPOINT = "https://profile.api.trailhead.com/graphql";
const PAGE = 100;

const Q_BADGES = `query Badges($slug: String, $count: Int, $after: String) {
  profile(slug: $slug) {
    __typename
    ... on PublicProfile {
      earnedAwards(first: $count, after: $after) {
        edges { node {
          ... on EarnedAwardBase { award { title type icon content { webUrl } } }
          ... on EarnedAwardSelf { award { title type icon content { webUrl } } earnedAt }
        } }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
}`;

const Q_STATS = `query Stats($slug: String) {
  profile(slug: $slug) {
    ... on PublicProfile {
      trailheadStats { ... on TrailheadProfileStats {
        earnedBadgesCount earnedPointsSum completedTrailCount
        rank { title imageUrl } nextRank { title }
      } }
      credential { certifications { title dateCompleted } }
    }
  }
}`;

const CREATE = [
  `CREATE TABLE IF NOT EXISTS trailhead_badges (
    path       TEXT PRIMARY KEY,   -- modules/prompt-fundamentals
    title      TEXT NOT NULL,
    type       TEXT,
    icon       TEXT,
    first_seen INTEGER NOT NULL    -- cuándo lo vio el servidor (Trailhead no publica la fecha)
  )`,
  `CREATE TABLE IF NOT EXISTS trailhead_meta (key TEXT PRIMARY KEY, value TEXT)`,
];

async function gql(query, variables) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "anthonymasyrubi.com roadmap (1 consulta por hora)" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Trailhead respondió ${r.status}`);
  const j = await r.json();
  if (j.errors?.length) throw new Error("Trailhead: " + String(j.errors[0].message).slice(0, 160));
  return j.data;
}

// path = lo que va después de /content/learn/ (o la URL entera si no es un módulo)
export function pathOf(url) {
  const m = String(url || "").match(/\/content\/learn\/((?:modules|projects|superbadges|trails)\/[a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export async function fetchProfile(slug) {
  const badges = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const d = await gql(Q_BADGES, { slug, count: PAGE, after });
    const ea = d?.profile?.earnedAwards;
    if (!ea) throw new Error("Trailhead no devolvió insignias (¿el perfil sigue público?)");
    for (const e of ea.edges || []) {
      const a = e?.node?.award;
      const path = pathOf(a?.content?.webUrl);
      if (a && path) badges.push({ path, title: String(a.title || path).slice(0, 160), type: a.type || null, icon: a.icon || null });
    }
    if (!ea.pageInfo?.hasNextPage) break;
    after = ea.pageInfo.endCursor;
  }
  const s = await gql(Q_STATS, { slug });
  const st = s?.profile?.trailheadStats || {};
  const certs = (s?.profile?.credential?.certifications || []).map(c => ({ title: c.title, date: c.dateCompleted || null }));
  return {
    badges,
    stats: {
      badges: st.earnedBadgesCount ?? badges.length, points: st.earnedPointsSum ?? null, trails: st.completedTrailCount ?? null,
      rank: st.rank?.title || null, rank_image: st.rank?.imageUrl || null, next_rank: st.nextRank?.title || null,
    },
    certs,
  };
}

/* Consulta Trailhead, guarda lo nuevo y devuelve qué cambió. notify(text) avisa por Telegram. */
export async function refreshTrailhead(env, notify = async () => {}) {
  if (!env.DB || !env.TRAILHEAD_SLUG) return { ok: false, error: "not_configured" };
  await env.DB.batch(CREATE.map(sql => env.DB.prepare(sql)));
  const metaGet = async k => (await env.DB.prepare("SELECT value FROM trailhead_meta WHERE key = ?").bind(k).first())?.value ?? null;
  const metaSet = (k, v) => env.DB.prepare("INSERT INTO trailhead_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v);

  let data;
  try {
    data = await fetchProfile(env.TRAILHEAD_SLUG);
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 200);
    const prevErr = await metaGet("last_error");
    await metaSet("last_error", JSON.stringify({ at: Date.now(), msg })).run();
    if (!prevErr) await notify(`⚠️ No pude leer tu perfil de Trailhead: ${msg}\nLa página del roadmap sigue mostrando la última copia.`);
    return { ok: false, error: msg };
  }

  const known = new Set(((await env.DB.prepare("SELECT path FROM trailhead_badges").all()).results || []).map(r => r.path));
  const firstRun = known.size === 0;
  const now = Date.now();
  const fresh = data.badges.filter(b => !known.has(b.path));
  const prevCerts = JSON.parse((await metaGet("certs")) || "[]");
  const newCerts = data.certs.filter(c => !prevCerts.some(p => p.title === c.title));

  const stmts = data.badges.map(b => env.DB.prepare(
    "INSERT INTO trailhead_badges (path, title, type, icon, first_seen) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT(path) DO UPDATE SET title = excluded.title, type = excluded.type, icon = excluded.icon"
  ).bind(b.path, b.title, b.type, b.icon, now));
  stmts.push(metaSet("stats", JSON.stringify(data.stats)), metaSet("certs", JSON.stringify(data.certs)),
    metaSet("checked_at", String(now)), env.DB.prepare("DELETE FROM trailhead_meta WHERE key = 'last_error'"));
  for (let i = 0; i < stmts.length; i += 45) await env.DB.batch(stmts.slice(i, i + 45));

  if (!firstRun && fresh.length) {
    const list = fresh.slice(0, 10).map(b => "• " + b.title).join("\n");
    await notify(`🏅 ${fresh.length === 1 ? "Nueva insignia" : fresh.length + " insignias nuevas"} en Trailhead:\n${list}\n\nTotal: ${data.stats.badges} · ${data.stats.rank || ""}`);
  }
  for (const c of newCerts) await notify(`🎓 ¡Certificación nueva en tu perfil! ${c.title}`);
  return { ok: true, badges: data.badges.length, new: firstRun ? 0 : fresh.length, first_run: firstRun, stats: data.stats };
}

export async function handleTrailheadGet(env, headers) {
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  if (!env.DB) return json({ error: "no_database" }, 500);
  try {
    const [b, m] = await Promise.all([
      env.DB.prepare("SELECT path, title, type, icon, first_seen FROM trailhead_badges ORDER BY first_seen DESC, title").all(),
      env.DB.prepare("SELECT key, value FROM trailhead_meta").all(),
    ]);
    const meta = Object.fromEntries((m.results || []).map(r => [r.key, r.value]));
    return json({
      slug: env.TRAILHEAD_SLUG || null,
      checked_at: meta.checked_at ? Number(meta.checked_at) : null,
      stats: meta.stats ? JSON.parse(meta.stats) : null,
      certs: meta.certs ? JSON.parse(meta.certs) : [],
      badges: b.results || [],
      error: meta.last_error ? JSON.parse(meta.last_error) : null,
    });
  } catch (err) {
    // Antes de la primera consulta las tablas no existen todavía
    return json({ slug: env.TRAILHEAD_SLUG || null, checked_at: null, stats: null, certs: [], badges: [], error: null });
  }
}
