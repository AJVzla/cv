/* Selector de modo (Claro / Oscuro / Outlook) para las páginas de especialidad. */
(function () {
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function setMode(m) {
    root.dataset.mode = m;
    document.querySelectorAll("[data-mode-btn]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.modeBtn === m));
    });
    store.set("cv-mode", m);
  }

  document.querySelectorAll("[data-mode-btn]").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.modeBtn); });
  });
  document.querySelectorAll("[data-mode-link]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); setMode(a.dataset.modeLink); });
  });

  var saved = store.get("cv-mode");
  var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setMode(saved || (dark ? "dark" : "light"));

  /* Copiar email */
  var copy = document.getElementById("copy-email");
  if (copy) copy.addEventListener("click", function () {
    var t = document.getElementById("toast");
    var done = function (ok) { if (t) t.textContent = ok ? "Email copiado: ajmercato@gmail.com" : "No se pudo copiar. La dirección es ajmercato@gmail.com"; };
    if (navigator.clipboard) navigator.clipboard.writeText("ajmercato@gmail.com").then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
})();
