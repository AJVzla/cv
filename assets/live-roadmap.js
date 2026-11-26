/* Tarjeta "En vivo" del inicio: avance del roadmap de Salesforce desde mi perfil de Trailhead. */
(function () {
  const box = document.getElementById("live-progress");
  if (!box) return;
  const en = () => document.documentElement.lang === "en";
  Promise.all([
    fetch("assets/roadmap-salesforce.json").then(r => r.json()),
    fetch("https://cv-chat.anthonymasyrubi.workers.dev/trailhead").then(r => (r.ok ? r.json() : null)),
  ]).then(([plan, th]) => {
    if (!th || !th.badges || !th.badges.length) return;
    const earned = new Set(th.badges.map(b => b.path));
    const certs = th.certs || [];
    let total = 0, done = 0;
    for (const st of plan.stages) {
      for (const g of st.groups) { total += g.items.length; done += g.items.filter(it => earned.has(it.path)).length; }
      total += 1;
      if (certs.some(c => st.cert.match.some(m => (c.title || "").toLowerCase().includes(m.toLowerCase())))) done += 1;
    }
    const pct = Math.round((done / total) * 100);
    const n = th.stats?.badges ?? th.badges.length;
    const last = th.badges[0]?.title;
    const paint = () => {
      document.getElementById("live-stats").textContent = en()
        ? `${pct}% of the roadmap · ${n} badges${last ? " · latest: " + last : ""}`
        : `${pct} % del roadmap · ${n} insignias${last ? " · última: " + last : ""}`;
    };
    document.getElementById("live-fill").style.width = Math.max(2, pct) + "%";
    paint();
    box.hidden = false;
    // Si cambia el idioma de la página, actualizo el texto
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }).catch(() => {});
})();
