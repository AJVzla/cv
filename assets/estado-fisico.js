/*
 * /estado-fisico: muestra el resumen que arma el servidor con los datos de Health Connect.
 * La API requiere una clave de acceso que se introduce en la página y no se guarda.
 * La demostración (#demo) es local y no necesita clave.
 */
const HEALTH_ENDPOINT = "https://cv-chat.anthonymasyrubi.workers.dev/health/summary";

(function () {
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat("es-AR");
  const nf1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const SVGNS = "http://www.w3.org/2000/svg";
  const STEP_GOAL = 10000;

  // Paleta validada (4 etapas de sueño, orden fijo). Claro / oscuro.
  const SLEEP = [
    { key: "deep_h", name: "Profundo", light: "#2a78d6", dark: "#3987e5" },
    { key: "rem_h", name: "REM", light: "#eb6834", dark: "#d95926" },
    { key: "light_h", name: "Liviano", light: "#1baf7a", dark: "#199e70" },
    { key: "awake_h", name: "Despierto", light: "#eda100", dark: "#c98500" },
  ];

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const isDark = () => document.documentElement.dataset.mode === "dark";
  const parseDay = d => new Date(d + "T12:00:00Z");
  const fmtDay = d => parseDay(d).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
  const fmtShort = d => parseDay(d).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", timeZone: "UTC" });
  const nfk = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
  const compact = v => (v >= 1000 ? nfk.format(Math.round(v / 100) / 10) + " k" : nf.format(Math.round(v)));
  const ago = min => (min < 1 ? "recién" : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`);

  function relDay(d, today) {
    const diff = Math.round((parseDay(today) - parseDay(d)) / 86_400_000);
    return diff === 0 ? "Hoy" : diff === 1 ? "Ayer" : fmtDay(d);
  }

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- tooltip ---------- */
  const tip = $("fx-tip");
  function showTip(evt, html) {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = evt.clientX + 14, y = evt.clientY - r.height - 12;
    if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - 14;
    if (y < 8) y = evt.clientY + 16;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /* ---------- columnas (pasos) ---------- */
  function columnChart(box, rows, { value, label, tipHtml, goal }) {
    box.innerHTML = "";
    const W = box.clientWidth || 600, H = W < 480 ? 180 : W > 700 ? 250 : 220;
    const m = { t: 22, r: goal ? 44 : 8, b: 26, l: 38 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = niceMax(Math.max(goal || 0, ...rows.map(value)));
    const y = v => m.t + ih - (v / max) * ih;
    const band = iw / rows.length, bw = Math.min(24, Math.max(3, band - 2));
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": label }, box);
    const grid = css("--line"), muted = css("--muted"), accent = css("--accent");

    for (const t of [0, max / 2, max]) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: grid, "stroke-width": 1 }, svg);
      const tx = el("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end", class: "fx-axis" }, svg); tx.textContent = compact(t);
    }
    if (goal) {
      el("line", { x1: m.l, x2: W - m.r + 2, y1: y(goal), y2: y(goal), stroke: muted, "stroke-width": 1, opacity: .7 }, svg);
      const g = el("text", { x: W - m.r + 6, y: y(goal) - 2, class: "fx-axis" }, svg); g.textContent = "Meta";
      const g2 = el("text", { x: W - m.r + 6, y: y(goal) + 11, class: "fx-axis" }, svg); g2.textContent = compact(goal);
    }
    let maxI = 0; rows.forEach((r, i) => { if (value(r) > value(rows[maxI])) maxI = i; });
    rows.forEach((r, i) => {
      const v = value(r), x = m.l + i * band + (band - bw) / 2;
      if (v > 0) {
        const top = y(v), h = m.t + ih - top, rr = Math.min(4, h, bw / 2);
        el("path", { d: `M${x},${m.t + ih}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + bw - rr}Q${x + bw},${top} ${x + bw},${top + rr}V${m.t + ih}Z`, fill: accent }, svg);
      }
      if (i === maxI && v > 0) {
        const t = el("text", { x: x + bw / 2, y: y(v) - 6, "text-anchor": "middle", class: "fx-val" }, svg); t.textContent = compact(v);
      }
      const every = W < 480 ? 7 : 5;
      if ((i % every === 0 && i < rows.length - Math.ceil(every / 2)) || i === rows.length - 1) {
        const t = el("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", class: "fx-axis" }, svg);
        t.textContent = i === rows.length - 1 ? "Hoy" : fmtShort(r.date);
      }
      const hit = el("rect", { x: m.l + i * band, y: m.t, width: band, height: ih, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", e => showTip(e, tipHtml(r)));
      hit.addEventListener("pointerleave", hideTip);
    });
  }

  /* ---------- columnas apiladas (sueño) ---------- */
  function stackedChart(box, nights, today) {
    box.innerHTML = "";
    const W = box.clientWidth || 600, H = W < 480 ? 180 : 210;
    const m = { t: 22, r: 8, b: 26, l: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = Math.max(10, Math.ceil(Math.max(...nights.map(n => n.hours)) / 2) * 2);
    const y = v => m.t + ih - (v / max) * ih;
    const band = iw / Math.max(nights.length, 7), bw = Math.min(24, band - 4);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Horas de sueño por noche, por etapa" }, box);
    const grid = css("--line");
    for (const t of [0, max / 2, max]) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: grid, "stroke-width": 1 }, svg);
      const tx = el("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end", class: "fx-axis" }, svg); tx.textContent = t + " h";
    }
    nights.forEach((n, i) => {
      const x = m.l + i * band + (band - bw) / 2;
      const staged = SLEEP.reduce((s, st) => s + (n[st.key] || 0), 0);
      // Si el reloj no mandó etapas, la barra entera va como "sueño" en el primer color.
      const parts = staged > 0 ? SLEEP.map(st => ({ st, v: n[st.key] || 0 })) : [{ st: SLEEP[0], v: n.hours }];
      let base = 0;
      const visible = parts.filter(p => p.v > 0);
      visible.forEach((p, k) => {
        const y0 = y(base), y1 = y(base + p.v);
        const gap = k > 0 ? 2 : 0;                 // 2px de superficie entre segmentos
        const h = Math.max(0, y0 - y1 - gap);
        const isTop = k === visible.length - 1, rr = isTop ? Math.min(4, h, bw / 2) : 0;
        const top = y1, bottom = y0 - gap;
        el("path", { d: rr
          ? `M${x},${bottom}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + bw - rr}Q${x + bw},${top} ${x + bw},${top + rr}V${bottom}Z`
          : `M${x},${bottom}V${top}H${x + bw}V${bottom}Z`, fill: isDark() ? p.st.dark : p.st.light }, svg);
        base += p.v;
      });
      if (i === nights.length - 1) {
        const t = el("text", { x: x + bw / 2, y: y(n.hours) - 6, "text-anchor": "middle", class: "fx-val" }, svg); t.textContent = nf1.format(n.hours) + " h";
      }
      if ((i % 3 === 0 && i < nights.length - 2) || i === nights.length - 1) {
        const t = el("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", class: "fx-axis" }, svg);
        t.textContent = n.date === today ? "Hoy" : fmtShort(n.date);
      }
      const hit = el("rect", { x: m.l + i * band, y: m.t, width: band, height: ih, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", e => showTip(e,
        `<b>Noche al ${fmtDay(n.date)}</b><br>${nf1.format(n.hours)} h en total` +
        (staged > 0 ? SLEEP.map(st => `<br><i style="background:${isDark() ? st.dark : st.light}"></i>${st.name}: ${nf1.format(n[st.key] || 0)} h`).join("") : "")));
      hit.addEventListener("pointerleave", hideTip);
    });
  }

  /* ---------- línea (pulso en reposo) ---------- */
  function lineChart(box, rows, { value, label, unit }) {
    box.innerHTML = "";
    const vals = rows.map(value).filter(v => v != null);
    if (!vals.length) { box.innerHTML = '<p class="fx-empty">Tu reloj todavía no registró pulso en reposo.</p>'; return; }
    const W = box.clientWidth || 600, H = W < 480 ? 150 : 170;
    const m = { t: 18, r: 46, b: 24, l: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const lo = Math.floor((Math.min(...vals) - 4) / 5) * 5, hi = Math.ceil((Math.max(...vals) + 4) / 5) * 5;
    const x = i => m.l + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
    const y = v => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": label }, box);
    const grid = css("--line"), accent = css("--accent"), surface = css("--sheet");
    for (const t of [lo, hi]) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: grid, "stroke-width": 1 }, svg);
      const tx = el("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end", class: "fx-axis" }, svg); tx.textContent = t;
    }
    // La línea une los días con dato (el pulso en reposo no se mide todos los días).
    let d = "", last = null;
    rows.forEach((r, i) => {
      const v = value(r);
      if (v == null) return;
      d += (last == null ? "M" : "L") + x(i) + "," + y(v); last = i;
    });
    el("path", { d, fill: "none", stroke: accent, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    rows.forEach((r, i) => { const v = value(r); if (v != null && (i === last || rows.filter(rr => value(rr) != null).length < 6)) el("circle", { cx: x(i), cy: y(v), r: 4, fill: accent, stroke: surface, "stroke-width": 2 }, svg); });
    const lv = el("text", { x: x(last) + 9, y: y(value(rows[last])) + 4, class: "fx-val" }, svg); lv.textContent = value(rows[last]) + " " + unit;
    [0, rows.length - 1].forEach(i => {
      const t = el("text", { x: x(i), y: H - 6, "text-anchor": i ? "end" : "start", class: "fx-axis" }, svg);
      t.textContent = i ? "Hoy" : fmtShort(rows[i].date);
    });
    // Cruz + tooltip
    const cross = el("line", { y1: m.t, y2: m.t + ih, stroke: css("--muted"), "stroke-width": 1, opacity: 0 }, svg);
    const hit = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
    hit.addEventListener("pointermove", e => {
      const px = (e.clientX - svg.getBoundingClientRect().left) * (W / svg.getBoundingClientRect().width);
      const i = Math.max(0, Math.min(rows.length - 1, Math.round(((px - m.l) / iw) * (rows.length - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", .5);
      const v = value(rows[i]);
      showTip(e, `<b>${fmtDay(rows[i].date)}</b><br>${v == null ? "Sin dato" : v + " " + unit}`);
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); hideTip(); });
  }

  /* ---------- rango de pulso por día (barras flotantes min–max + promedio) ---------- */
  function rangeChart(box, rows) {
    box.innerHTML = "";
    const have = rows.filter(r => r.hr_min != null && r.hr_max != null);
    if (!have.length) { box.innerHTML = '<p class="fx-empty">Todavía no hay pulso registrado.</p>'; return; }
    const W = box.clientWidth || 500, H = W < 480 ? 170 : 200;
    const m = { t: 14, r: 8, b: 26, l: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const lo = Math.floor(Math.min(...have.map(r => r.hr_min)) / 20) * 20, hi = Math.ceil(Math.max(...have.map(r => r.hr_max)) / 20) * 20;
    const y = v => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const band = iw / rows.length, bw = Math.min(10, Math.max(3, band - 3));
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Pulso mínimo, máximo y promedio por día" }, box);
    const grid = css("--line"), accent = css("--accent"), ink = css("--ink");
    for (const t of [lo, (lo + hi) / 2, hi]) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: grid, "stroke-width": 1 }, svg);
      const tx = el("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end", class: "fx-axis" }, svg); tx.textContent = Math.round(t);
    }
    rows.forEach((r, i) => {
      const cx = m.l + i * band + band / 2;
      if (r.hr_min != null) {
        el("rect", { x: cx - bw / 2, y: y(r.hr_max), width: bw, height: Math.max(2, y(r.hr_min) - y(r.hr_max)), rx: Math.min(4, bw / 2), fill: accent, opacity: .35 }, svg);
        if (r.hr_avg != null) el("rect", { x: cx - bw / 2 - 1, y: y(r.hr_avg) - 1, width: bw + 2, height: 2.5, fill: ink }, svg);
      }
      const every = W < 480 ? 7 : 5;
      if ((i % every === 0 && i < rows.length - Math.ceil(every / 2)) || i === rows.length - 1) {
        const t = el("text", { x: cx, y: H - 6, "text-anchor": "middle", class: "fx-axis" }, svg);
        t.textContent = i === rows.length - 1 ? "Hoy" : fmtShort(r.date);
      }
      const hit = el("rect", { x: m.l + i * band, y: m.t, width: band, height: ih, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", e => showTip(e, r.hr_min == null ? `<b>${fmtDay(r.date)}</b><br>Sin datos`
        : `<b>${fmtDay(r.date)}</b><br>Mín. ${r.hr_min} · Prom. ${r.hr_avg ?? "—"} · Máx. ${r.hr_max} bpm`));
      hit.addEventListener("pointerleave", hideTip);
    });
  }

  /* ---------- piezas del tablero ---------- */
  const mean = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const sum = arr => arr.reduce((s, x) => s + (x || 0), 0);

  // Diferencia contra una referencia, siempre con flecha y texto (nunca solo color)
  function delta(now, ref, { unit = "%", lowerIsBetter = false, abs = false } = {}) {
    if (now == null || ref == null || ref === 0) return "";
    const diff = abs ? now - ref : ((now - ref) / ref) * 100;
    const r = Math.round(diff * (abs ? 10 : 1)) / (abs ? 10 : 1);
    if (r === 0) return '<span class="fx-delta">= igual</span>';
    const arrow = r > 0 ? "▲" : "▼";
    const txt = abs ? nf1.format(Math.abs(r)) + " " + unit : Math.abs(r) + "%";
    return `<span class="fx-delta">${arrow} ${txt}</span>`;
  }

  function kpi(id, label, value, note, extra = "") {
    $(id).innerHTML = `<p class="fx-kpi-label">${label}</p><p class="fx-kpi-value">${value}</p>${note ? `<p class="fx-kpi-note">${note}</p>` : ""}${extra}`;
  }

  function renderPulse(h) {
    const fig = $("fx-pulse");
    if (h.last_bpm == null) { $("fx-bpm").textContent = "—"; $("fx-pulse-meta").textContent = "Sin pulso registrado"; fig.classList.add("is-idle"); return; }
    $("fx-bpm").textContent = h.last_bpm;
    const stale = h.last_minutes_ago > 180;
    $("fx-pulse-meta").textContent = (stale ? "Sin datos recientes · " : "") + ago(h.last_minutes_ago);
    fig.classList.toggle("is-idle", stale);
    fig.style.setProperty("--beat", (60 / Math.max(35, Math.min(200, h.last_bpm))).toFixed(3) + "s");
  }

  // Algunas apps (por ejemplo Strava) guardan los entrenamientos sin tipo en Health Connect.
  // Si el tipo es genérico, se deduce del nombre ("Morning Run" → Correr) y se calcula el ritmo.
  const TYPE_FROM_TITLE = [
    [/\b(run|running|jog|correr|carrera|trote)\b/i, "Correr", true],
    [/\b(walk|walking|caminata|caminar|paseo)\b/i, "Caminata", true],
    [/\b(hike|hiking|trek|trekking|senderismo)\b/i, "Trekking", true],
    [/\b(ride|riding|cycling|bike|bici|ciclismo)\b/i, "Bici", false],
    [/\b(swim|swimming|nataci[oó]n|nadar)\b/i, "Natación", false],
    [/\b(yoga)\b/i, "Yoga", false],
    [/\b(weight|weights|strength|gym|fuerza|pesas)\b/i, "Fuerza", false],
  ];
  function fixWorkout(w) {
    if (w.type !== 0 || !w.title) return w;
    const hit = TYPE_FROM_TITLE.find(([re]) => re.test(w.title));
    if (!hit) return w;
    const [, name, hasPace] = hit;
    const pace = hasPace && !w.pace_min_km && w.distance_km > 0.3 && w.duration_min > 0
      ? Math.round((w.duration_min / w.distance_km) * 100) / 100 : w.pace_min_km;
    return { ...w, name, pace_min_km: pace };
  }

  function paceText(p) { return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`; }

  let DATA = null;

  function render() {
    const d = DATA; if (!d) return;
    const days = d.days || [];
    const today = d.today || days[days.length - 1];
    const past = days.slice(0, -1);                     // los 29 días anteriores a hoy
    const h = d.heart || {};
    const nights = (d.sleep || []).slice(-14);
    const ws = (d.workouts || []).map(fixWorkout);

    // Encabezado
    const minsAgo = d.updated_at ? Math.round((Date.now() - d.updated_at) / 60000) : null;
    $("fx-updated").textContent = minsAgo == null ? "Todavía sin datos" : "Actualizado " + ago(minsAgo);
    document.querySelector(".fx-live").classList.toggle("is-stale", minsAgo == null || minsAgo > 120);
    renderPulse(h);

    // Indicadores (hoy contra el promedio de los días anteriores)
    const avgSteps = mean(past.filter(x => x.steps > 0).map(x => x.steps));
    const pct = Math.min(100, Math.round((today.steps / STEP_GOAL) * 100));
    const noDataToday = today.steps === 0 && today.hr_avg == null && !today.distance_km;
    kpi("kpi-steps", "Pasos hoy", noDataToday ? "—" : nf.format(today.steps), noDataToday ? "Sin datos de hoy todavía" : `${pct}% de la meta`,
      `<div class="fx-meter" role="img" aria-label="${pct}% de la meta de ${nf.format(STEP_GOAL)}"><i style="width:${pct}%"></i></div>`);
    kpi("kpi-distance", "Distancia hoy", nf1.format(today.distance_km) + " <small>km</small>",
      avgSteps ? `Prom. ${nf1.format(mean(past.filter(x => x.steps > 0).map(x => x.distance_km)))} km/día` : "");
    kpi("kpi-kcal", "Calorías activas", nf.format(today.active_kcal) + " <small>kcal</small>",
      `Prom. ${nf.format(Math.round(mean(past.filter(x => x.steps > 0).map(x => x.active_kcal)) || 0))} kcal/día`);
    const lastNight = nights.filter(n => n.date === today.date).pop();
    const avgSleep = mean(nights.map(n => n.hours));
    kpi("kpi-sleep", "Sueño anoche", lastNight ? nf1.format(lastNight.hours) + " <small>h</small>" : "—",
      lastNight ? `${delta(lastNight.hours, avgSleep, { abs: true, unit: "h" }) || "Igual"} vs. promedio` : "Sin registro");
    const rhrAvg = mean(past.map(x => x.resting_bpm));
    kpi("kpi-rhr", "Pulso en reposo", h.resting ? h.resting.value + " <small>bpm</small>" : "—",
      h.resting ? (rhrAvg ? `${delta(h.resting.value, rhrAvg, { abs: true, unit: "bpm" }) || "Igual"} vs. promedio` : relDay(h.resting.date, today.date)) : "Sin registro");

    // Pasos por día
    const withSteps = days.filter(x => x.steps > 0);
    const avg = withSteps.length ? Math.round(sum(withSteps.map(x => x.steps)) / withSteps.length) : 0;
    const goalDays = days.filter(x => x.steps >= STEP_GOAL).length;
    $("fx-steps-sub").textContent = withSteps.length ? `Prom. ${nf.format(avg)} · ${goalDays} ${goalDays === 1 ? "día" : "días"} sobre la meta` : "Sin pasos registrados";
    columnChart($("fx-steps-chart"), days, {
      value: x => x.steps, goal: STEP_GOAL, label: "Pasos por día, últimos 30 días",
      tipHtml: x => `<b>${fmtDay(x.date)}</b><br>${nf.format(x.steps)} pasos<br>${nf1.format(x.distance_km)} km · ${nf.format(x.active_kcal)} kcal`,
    });

    // Últimos 7 días contra los 7 anteriores
    const w1 = days.slice(-7), w0 = days.slice(-14, -7);
    const inRange = (list, from, to) => list.filter(w => w.date >= from && w.date <= to);
    const wk1 = w1.length ? inRange(ws, w1[0].date, w1[w1.length - 1].date) : [];
    const wk0 = w0.length ? inRange(ws, w0[0].date, w0[w0.length - 1].date) : [];
    const s1 = nights.filter(n => w1.some(x => x.date === n.date)), s0 = nights.filter(n => w0.some(x => x.date === n.date));
    const cell = (label, value, note) => `<div><dt>${label}</dt><dd>${value}</dd><p class="fx-kpi-note">${note || "&nbsp;"}</p></div>`;
    $("fx-week").innerHTML =
      cell("Pasos", nf.format(sum(w1.map(x => x.steps))), delta(sum(w1.map(x => x.steps)), sum(w0.map(x => x.steps)))) +
      cell("Distancia", nf1.format(sum(w1.map(x => x.distance_km))) + " km", delta(sum(w1.map(x => x.distance_km)), sum(w0.map(x => x.distance_km)))) +
      cell("Entrenamientos", wk1.length, wk0.length || wk1.length ? `${wk1.length - wk0.length >= 0 ? "▲" : "▼"} ${Math.abs(wk1.length - wk0.length)} vs. semana anterior` : "") +
      cell("Minutos activos", nf.format(sum(wk1.map(w => w.duration_min))), delta(sum(wk1.map(w => w.duration_min)), sum(wk0.map(w => w.duration_min)))) +
      cell("Sueño promedio", s1.length ? nf1.format(mean(s1.map(n => n.hours))) + " h" : "—", s1.length && s0.length ? delta(mean(s1.map(n => n.hours)), mean(s0.map(n => n.hours)), { abs: true, unit: "h" }) : "") +
      cell("Calorías activas", nf.format(sum(w1.map(x => x.active_kcal))), delta(sum(w1.map(x => x.active_kcal)), sum(w0.map(x => x.active_kcal))));

    // Sueño 14 noches
    const color = st => (isDark() ? st.dark : st.light);
    if (nights.length) {
      $("fx-sleep-sub").textContent = `Prom. ${nf1.format(avgSleep)} h por noche`;
      $("fx-sleep-legend").innerHTML = SLEEP.map(st => `<li><i style="background:${color(st)}"></i>${st.name} <b>${nf1.format(mean(nights.map(n => n[st.key] || 0)))} h</b></li>`).join("");
      stackedChart($("fx-sleep-chart"), nights, today.date);
    } else {
      $("fx-sleep-sub").textContent = ""; $("fx-sleep-legend").innerHTML = "";
      $("fx-sleep-chart").innerHTML = '<p class="fx-empty">Todavía no hay noches registradas.</p>';
    }

    // Anoche: barra segmentada + detalle
    const night = lastNight || nights[nights.length - 1];
    if (night) {
      const staged = SLEEP.reduce((s, st) => s + (night[st.key] || 0), 0);
      $("fx-night-sub").textContent = night === lastNight ? "" : "Última noche registrada: " + fmtDay(night.date);
      $("fx-night").innerHTML = `<p class="fx-night-total">${nf1.format(night.hours)} <small class="fx-kpi-note">h dormidas</small></p>` +
        (staged > 0
          ? `<div class="fx-seg" role="img" aria-label="Etapas del sueño">${SLEEP.map(st => night[st.key] ? `<span style="flex:${night[st.key]};background:${color(st)}" title="${st.name}"></span>` : "").join("")}</div>
             <ul class="fx-seg-list">${SLEEP.map(st => `<li><i style="background:${color(st)}"></i>${st.name}<b>${nf1.format(night[st.key] || 0)} h</b><span>${Math.round(((night[st.key] || 0) / staged) * 100)}%</span></li>`).join("")}</ul>`
          : '<p class="fx-empty">Tu reloj no informó las etapas de esta noche.</p>');
    } else {
      $("fx-night-sub").textContent = "";
      $("fx-night").innerHTML = '<p class="fx-empty">Sin noches registradas.</p>';
    }

    // Pulso por día y en reposo
    rangeChart($("fx-hr-chart"), days);
    $("fx-rhr-sub").textContent = h.vo2max ? `VO₂ máx ${nf1.format(h.vo2max.value)} ml/kg/min · ${relDay(h.vo2max.date, today.date)}` : (rhrAvg ? `Prom. ${Math.round(rhrAvg)} bpm` : "");
    lineChart($("fx-rhr-chart"), days, { value: x => x.resting_bpm, label: "Pulso en reposo por día", unit: "bpm" });

    // Entrenamientos
    const mins30 = sum(ws.filter(w => days.length && w.date >= days[0].date).map(w => w.duration_min));
    $("fx-workouts-sub").textContent = ws.length ? `${ws.length} registrados · ${nf.format(mins30)} min en 30 días` : "";
    $("fx-workouts").innerHTML = ws.length
      ? `<thead><tr><th>Día</th><th>Actividad</th><th class="num">Duración</th><th class="num">Distancia</th><th class="num fx-hide-sm">Ritmo</th><th class="num fx-hide-sm">Pulso prom.</th></tr></thead><tbody>` +
        ws.slice(0, 6).map(w => {
          const title = w.title && w.title !== w.name ? `<span class="fx-wtitle">${w.title.replace(/[<>&"]/g, "")}</span>` : "";
          return `<tr><td>${relDay(w.date, today.date)}</td><td class="fx-wname">${w.name}${title}</td><td class="num">${w.duration_min} min</td>` +
            `<td class="num">${w.distance_km ? nf1.format(w.distance_km) + " km" : "—"}</td>` +
            `<td class="num fx-hide-sm">${w.pace_min_km ? paceText(w.pace_min_km) + " /km" : "—"}</td>` +
            `<td class="num fx-hide-sm">${w.avg_bpm ? w.avg_bpm + " bpm" : "—"}</td></tr>`;
        }).join("") + "</tbody>"
      : '<tbody><tr><td class="fx-empty" style="border:0">Todavía no hay entrenamientos registrados.</td></tr></tbody>';

    // Mezcla por tipo (minutos en 30 días), una sola serie: un color
    const byType = new Map();
    ws.filter(w => days.length && w.date >= days[0].date).forEach(w => {
      const t = byType.get(w.name) || { min: 0, n: 0 }; t.min += w.duration_min || 0; t.n++; byType.set(w.name, t);
    });
    const mix = [...byType.entries()].sort((a, b) => b[1].min - a[1].min).slice(0, 6);
    const maxMin = mix.length ? mix[0][1].min : 1;
    $("fx-mix").innerHTML = mix.length
      ? `<ul class="fx-mix">${mix.map(([name, t]) => `<li><div class="fx-mix-row"><b>${name}</b><span>${nf.format(t.min)} min · ${t.n} ${t.n === 1 ? "vez" : "veces"}</span></div><div class="fx-mix-bar" style="width:${Math.max(2, (t.min / maxMin) * 100)}%"></div></li>`).join("")}</ul>`
      : '<p class="fx-empty">Sin entrenamientos en los últimos 30 días.</p>';

    // Tabla
    $("fx-table").innerHTML = "<thead><tr><th>Día</th><th>Pasos</th><th>Km</th><th>Kcal activas</th><th>Sueño (h)</th><th>Pulso reposo</th><th>Pulso prom.</th><th>Pulso mín–máx</th><th>Entrenamientos</th></tr></thead><tbody>" +
      days.slice().reverse().map(x => `<tr><td>${fmtDay(x.date)}</td><td>${nf.format(x.steps)}</td><td>${nf1.format(x.distance_km)}</td><td>${nf.format(x.active_kcal)}</td><td>${x.sleep_h != null ? nf1.format(x.sleep_h) : "—"}</td><td>${x.resting_bpm ?? "—"}</td><td>${x.hr_avg ?? "—"}</td><td>${x.hr_min != null ? x.hr_min + "–" + x.hr_max : "—"}</td><td>${x.workouts || "—"}</td></tr>`).join("") + "</tbody>";
  }

  /* ---------- datos ---------- */
  function demoData() {
    const days = [], sleep = [], workouts = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now - i * 86_400_000 - 3 * 3600_000).toISOString().slice(0, 10);
      const s = Math.round(6500 + 4200 * Math.abs(Math.sin(i * 1.7)) + (i % 6 === 0 ? 3500 : 0)) * (i === 0 ? 0.55 : 1);
      days.push({ date: dt, steps: Math.round(s), distance_km: Math.round(s * 0.00078 * 100) / 100, active_kcal: Math.round(s * 0.045), sleep_h: null,
        hr_avg: 70 + (i % 4), hr_min: 54 + (i % 3), hr_max: i % 6 === 0 ? 168 : 118 + (i % 9), resting_bpm: i % 5 === 3 ? null : 57 + Math.round(2 * Math.sin(i / 3)) + (i > 20 ? 1 : 0), workouts: i % 6 === 0 ? 1 : 0 });
      if (i < 14) {
        const hrs = Math.round((6.4 + 1.4 * Math.abs(Math.cos(i * 1.3))) * 10) / 10;
        const deep = Math.round(hrs * 0.18 * 10) / 10, rem = Math.round(hrs * 0.22 * 10) / 10, awake = Math.round(hrs * 0.06 * 10) / 10;
        sleep.push({ date: dt, hours: hrs, deep_h: deep, rem_h: rem, awake_h: awake, light_h: Math.round((hrs - deep - rem - awake) * 10) / 10 });
        days[days.length - 1].sleep_h = hrs;
      }
      if (i % 6 === 0) workouts.unshift({ date: dt, type: 56, name: "Correr", title: null, duration_min: 38 + (i % 4) * 3, distance_km: 6.2 + (i % 5) * 0.4, avg_bpm: 151 + (i % 3), pace_min_km: 5.7 + (i % 3) * 0.08, steps: 6100 });
      if (i % 7 === 2) workouts.unshift({ date: dt, type: 70, name: "Fuerza", title: null, duration_min: 50, distance_km: null, avg_bpm: 118, pace_min_km: null, steps: null });
    }
    return { updated_at: Date.now() - 9 * 60000, today: days[29], days, sleep, workouts,
      heart: { last_bpm: 68, last_minutes_ago: 9, resting: { value: 57, date: days[29].date }, vo2max: { value: 46.3, date: days[27].date } } };
  }

  let viewKey = "";
  async function load() {
    const status = $("fx-status");
    const demo = location.hash === "#demo";
    try {
      if (demo) DATA = demoData();
      else if (!HEALTH_ENDPOINT) {
        status.innerHTML = 'La página todavía no está conectada al reloj. <a href="#demo">Ver una demostración con datos de ejemplo</a>.';
        return false;
      } else {
        status.hidden = false;
        status.textContent = "Cargando datos del reloj…";
        const headers = { Accept: "application/json" };
        if (viewKey) headers.Authorization = "Bearer " + viewKey;
        const res = await fetch(HEALTH_ENDPOINT, { headers, cache: "no-store" });
        if (res.status === 401) {
          status.textContent = "Este panel es privado. Ingresá tu clave de acceso.";
          $("fx-login").hidden = false;
          $("fx-logout").hidden = true;
          return false;
        }
        if (res.status === 503) {
          status.textContent = "El acceso privado todavía no está configurado en el servidor.";
          return false;
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        DATA = await res.json();
      }
    } catch (e) {
      status.innerHTML = 'No pude cargar los datos del reloj. Probá de nuevo en un rato, o <a href="#demo">mirá una demostración</a>.';
      return false;
    }
    $("fx-login").hidden = true;
    $("fx-logout").hidden = demo;
    if (!DATA.updated_at && !demo) {
      status.innerHTML = 'Todavía no llegaron datos del reloj. Aparecen acá después de la primera sincronización. <a href="#demo">Ver una demostración</a>.';
      return true;
    }
    status.textContent = demo ? "Demostración con datos de ejemplo." : "";
    status.hidden = !demo;
    $("fx-content").hidden = false;
    render();
    return true;
  }

  $("fx-login").addEventListener("submit", async e => {
    e.preventDefault();
    const input = $("fx-password");
    const error = $("fx-login-error");
    viewKey = input.value;
    error.hidden = true;
    const button = $("fx-login").querySelector("button");
    button.disabled = true;
    try {
      if (await load()) input.value = "";
      else if (viewKey) {
        viewKey = "";
        error.textContent = "No se pudo abrir el panel. Revisá la clave e intentá de nuevo.";
        error.hidden = false;
        input.select();
      }
    } finally {
      button.disabled = false;
    }
  });
  $("fx-logout").addEventListener("click", () => {
    viewKey = "";
    DATA = null;
    $("fx-content").hidden = true;
    $("fx-logout").hidden = true;
    $("fx-status").hidden = false;
    $("fx-status").textContent = "Ingresá tu clave para volver a ver el panel.";
    $("fx-login").hidden = false;
    $("fx-password").value = "";
    $("fx-password").focus();
  });
  window.addEventListener("hashchange", () => { DATA = null; $("fx-content").hidden = true; $("fx-status").hidden = false; $("fx-status").textContent = "Cargando datos del reloj…"; load(); });
  // Los colores dependen del modo: redibujar al cambiarlo y al cambiar el ancho.
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(render, 120); }).observe($("fx-content"));
  load();
})();
