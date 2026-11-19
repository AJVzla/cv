/* Visor del email de ejemplo: escritorio o celular, tema claro u oscuro. */
(function () {
  var stage = document.getElementById("ev-stage");
  var frame = document.getElementById("ev-frame");
  var note = document.getElementById("ev-note");
  if (!stage || !frame) return;

  var IMG_ABS = "https://anthonymasyrubi.com/maquetacion-emails-html/ejemplo/img/";
  var DARK_MQ = "@media (prefers-color-scheme: dark)";
  var source = null;
  var state = { view: "desktop", theme: "light" };

  var NOTES = {
    "desktop-light": "Vista de escritorio, a 600 px de ancho.",
    "desktop-dark": "Modo oscuro con los estilos propios del email, como en Apple Mail.",
    "mobile-light": "Vista de celular, a 375 px de ancho.",
    "mobile-dark": "Celular en modo oscuro, como en Apple Mail para iPhone."
  };

  function render() {
    if (source == null) return;
    // El iframe hereda el tema del sistema: forzamos el que eligió la persona.
    var html = source
      .split(DARK_MQ).join(state.theme === "dark" ? "@media all" : "@media not all")
      .split(IMG_ABS).join("img/");
    frame.srcdoc = html;
    note.textContent = NOTES[state.view + "-" + state.theme];
  }

  function fit() {
    try {
      var doc = frame.contentDocument;
      if (doc && doc.body) frame.style.height = doc.documentElement.scrollHeight + "px";
    } catch (e) {}
  }
  frame.addEventListener("load", function () {
    fit();
    try {
      // Los links del ejemplo no llevan a ningún lado.
      frame.contentDocument.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest("a");
        if (a) e.preventDefault();
      });
      frame.contentWindow.addEventListener("resize", fit);
      var imgs = frame.contentDocument.images;
      for (var i = 0; i < imgs.length; i++) imgs[i].addEventListener("load", fit);
    } catch (e) {}
  });

  function bind(attr, key) {
    document.querySelectorAll("[" + attr + "]").forEach(function (b) {
      b.addEventListener("click", function () {
        state[key] = b.getAttribute(attr);
        document.querySelectorAll("[" + attr + "]").forEach(function (o) {
          o.setAttribute("aria-pressed", String(o === b));
        });
        stage.dataset.view = state.view;
        stage.dataset.theme = state.theme;
        render();
      });
    });
  }
  bind("data-ev-view", "view");
  bind("data-ev-theme", "theme");

  fetch("email.html").then(function (r) { return r.text(); }).then(function (t) {
    source = t;
    render();
  }).catch(function () {
    frame.removeAttribute("srcdoc");
    frame.src = "email.html";
  });
})();
