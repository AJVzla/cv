/*
 * Roadmap de Salesforce: cruza el plan (roadmap-salesforce.json) con las insignias
 * de mi perfil de Trailhead, que el Worker guarda cada hora (GET /trailhead).
 */
(function () {
  const TRAILHEAD_ENDPOINT = "https://cv-chat.anthonymasyrubi.workers.dev/trailhead";
  const PLAN_URL = "../assets/roadmap-salesforce.json";
  const TH = "https://trailhead.salesforce.com/es/content/learn/";
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat("es-AR");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const iconOk = url => /^https:\/\/(res\.cloudinary\.com|trailhead\.salesforce\.com|developer\.salesforce\.com)\//.test(url || "");

  function ago(ms) {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 2) return "recién";
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? "día" : "días"}`;
  }

  const bar = (done, total) => `<span class="rm-bar" role="img" aria-label="${done} de ${total}"><i style="width:${total ? Math.round((done / total) * 100) : 0}%"></i></span>`;

  function itemHtml(it, badge) {
    const icon = badge && iconOk(badge.icon)
      ? `<img src="${esc(badge.icon)}" alt="" width="40" height="40" loading="lazy">`
      : `<span class="rm-dot" aria-hidden="true"></span>`;
    const kind = it.path.startsWith("projects/") ? "Proyecto" : it.path.startsWith("superbadges/") ? "Superbadge" : "";
    return `<li class="${badge ? "is-done" : ""}">${icon}<a href="${TH + esc(it.path)}" target="_blank" rel="noopener">${esc(it.title)}</a>` +
      `<span class="rm-state">${badge ? "Insignia ganada" : kind || "Pendiente"}</span></li>`;
  }

  function render(plan, th) {
    const earned = new Map((th?.badges || []).map(b => [b.path, b]));
    const certs = th?.certs || [];
    const inPlan = new Set();
    let total = 0, done = 0;
    let openedStage = false;

    const stagesHtml = plan.stages.map(st => {
      let sTotal = 0, sDone = 0;
      const cert = certs.find(c => st.cert.match.some(m => (c.title || "").toLowerCase().includes(m.toLowerCase())));
      const groups = st.groups.map(g => {
        const gDone = g.items.filter(it => earned.has(it.path)).length;
        g.items.forEach(it => inPlan.add(it.path));
        sTotal += g.items.length; sDone += gDone;
        // Primero lo ganado, en el orden del plan; después lo pendiente
        const sorted = [...g.items.filter(it => earned.has(it.path)), ...g.items.filter(it => !earned.has(it.path))];
        const open = gDone > 0 && gDone < g.items.length;
        return `<details class="rm-group"${open ? " open" : ""}><summary>` +
          `<span class="rm-gname">${esc(g.name)}</span><span class="rm-count">${gDone}/${g.items.length}</span>${bar(gDone, g.items.length)}</summary>` +
          `<p class="rm-note">${esc(g.note)} <a href="${esc(g.url)}" target="_blank" rel="noopener">Ver en Trailhead</a></p>` +
          `<ul class="rm-items">${sorted.map(it => itemHtml(it, earned.get(it.path))).join("")}</ul></details>`;
      }).join("");
      total += sTotal + 1; done += sDone + (cert ? 1 : 0);
      const complete = cert && sDone === sTotal;
      const open = !openedStage && !complete;
      if (open) openedStage = true;
      const certHtml = `<div class="rm-cert${cert ? " is-done" : ""}"><span class="rm-cert-icon" aria-hidden="true">${cert ? "✓" : "◇"}</span>` +
        `<div><p class="rm-cert-name">Examen: <a href="${esc(st.cert.url)}" target="_blank" rel="noopener">${esc(st.cert.title)}</a></p>` +
        `<p class="rm-small">${cert ? "Certificado" + (cert.date ? " el " + new Date(cert.date + "T12:00:00").toLocaleDateString("es-AR") : "") : "Pendiente · " + esc(st.cert.cost)}</p></div></div>`;
      return `<details class="rm-stage"${open ? " open" : ""} id="${esc(st.id)}"><summary>` +
        `<span class="rm-sname">${esc(st.name)}</span><span class="rm-when">${esc(st.when)}</span>` +
        `<span class="rm-sprog"><b>${sDone}</b> de ${sTotal} cursos ${cert ? "· certificado ✓" : ""}</span>${bar(sDone, sTotal)}</summary>` +
        `<div class="rm-stage-body"><p class="rm-goal">${esc(st.goal)}</p>${groups}${certHtml}</div></details>`;
    }).join("");
    $("rm-stages").innerHTML = stagesHtml;
    // Si una imagen de insignia no carga, queda un círculo con tilde en su lugar
    document.querySelectorAll(".rm-items img, .rm-extra img").forEach(img => img.addEventListener("error", () => {
      const ok = document.createElement("span"); ok.className = "rm-dot is-ok"; ok.setAttribute("aria-hidden", "true"); ok.textContent = "✓";
      img.replaceWith(ok);
    }, { once: true }));

    // Resumen
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("rm-pct").textContent = pct + " %";
    $("rm-bar").setAttribute("aria-label", `${pct} % del roadmap completo`);
    $("rm-bar").firstElementChild.style.width = pct + "%";
    const s = th?.stats;
    if (s) {
      $("rm-rank").textContent = s.rank || "—";
      $("rm-next").textContent = s.next_rank ? `Próximo: ${s.next_rank}` : "";
      $("rm-badges").textContent = nf.format(s.badges ?? earned.size);
      $("rm-points").textContent = s.points != null ? nf.format(s.points) : "—";
      $("rm-rank-img").addEventListener("error", () => { $("rm-rank-img").hidden = true; }, { once: true });
      if (iconOk(s.rank_image)) { $("rm-rank-img").src = s.rank_image; $("rm-rank-img").alt = "Rango " + (s.rank || ""); $("rm-rank-img").hidden = false; }
    }

    // Insignias que no están en el plan
    const extra = (th?.badges || []).filter(b => !inPlan.has(b.path));
    $("rm-extra-block").hidden = !extra.length;
    $("rm-extra").innerHTML = extra.map(b => `<li>${iconOk(b.icon) ? `<img src="${esc(b.icon)}" alt="" width="40" height="40" loading="lazy">` : ""}` +
      `<a href="${TH + esc(b.path)}" target="_blank" rel="noopener">${esc(b.title)}</a></li>`).join("");

    // Pie
    const when = th?.checked_at ? ` Actualizado ${ago(th.checked_at)}.` : th ? " Todavía no se consultó Trailhead." : " No pude leer las insignias ahora: se muestra solo el plan.";
    $("rm-foot").innerHTML = `Datos de mi <a href="https://www.salesforce.com/trailblazer/anthonymasyrubi" target="_blank" rel="noopener">perfil público de Trailhead</a>.${when}`;
  }

  Promise.all([
    fetch(PLAN_URL).then(r => r.json()),
    fetch(TRAILHEAD_ENDPOINT, { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined })
      .then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([plan, th]) => render(plan, th))
    .catch(() => { $("rm-stages").innerHTML = '<p class="rm-loading">No pude cargar el roadmap. Probá recargar la página.</p>'; });
})();
