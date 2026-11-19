/*
 * Métricas del sitio.
 *
 * 1) Cloudflare Web Analytics: visitas, páginas, países y desde dónde llegan.
 *    Gratis y sin cookies. Pegá el token de tu sitio en CF_TOKEN
 *    (Cloudflare → Analytics & Logs → Web Analytics → anthonymasyrubi.com).
 *    El token no es secreto: queda visible en el HTML de cualquier sitio que lo usa.
 *
 * 2) Eventos propios (descargas del PDF): se mandan al Worker del chat,
 *    que los cuenta y te avisa por Telegram. Ver /stats en el bot.
 */
(function () {
  var CF_TOKEN = "";
  var EVENT_ENDPOINT = "https://cv-chat.anthonymasyrubi.workers.dev/event";

  var local = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);

  if (CF_TOKEN && !local) {
    var s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_TOKEN }));
    document.head.appendChild(s);
  }

  window.cvTrack = function (type, lang) {
    if (local || !EVENT_ENDPOINT) return;
    var body = JSON.stringify({ type: type, lang: lang === "en" ? "en" : "es", page: location.pathname });
    try {
      // text/plain evita el preflight de CORS; sendBeacon sobrevive aunque la pestaña se cierre.
      var blob = new Blob([body], { type: "text/plain" });
      if (navigator.sendBeacon && navigator.sendBeacon(EVENT_ENDPOINT, blob)) return;
      fetch(EVENT_ENDPOINT, { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true, mode: "cors" }).catch(function () {});
    } catch (e) {}
  };
})();
