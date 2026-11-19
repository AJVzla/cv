/* Visor de un sitio en vivo: escritorio, tablet o celular, achicado para que entre. */
(function () {
  var stage = document.getElementById("sv-stage");
  var viewport = document.getElementById("sv-viewport");
  var frame = document.getElementById("sv-frame");
  var note = document.getElementById("sv-note");
  if (!stage || !viewport || !frame) return;

  var SIZES = {
    desktop: { w: 1280, h: 800, note: "Escritorio a 1280 px" },
    tablet: { w: 768, h: 1024, note: "Tablet a 768 px" },
    mobile: { w: 390, h: 760, note: "Celular a 390 px" }
  };
  var view = "desktop";

  function layout() {
    var s = SIZES[view];
    var device = stage.querySelector(".sv-device");
    var cs = getComputedStyle(stage);
    var border = 2 * (parseFloat(getComputedStyle(device).borderLeftWidth) || 0);
    var avail = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - border;
    var scale = Math.min(1, avail / s.w);
    viewport.style.width = Math.floor(s.w * scale) + "px";
    viewport.style.height = Math.floor(s.h * scale) + "px";
    frame.style.width = s.w + "px";
    frame.style.height = s.h + "px";
    frame.style.transform = "scale(" + scale + ")";
    device.style.width = Math.floor(s.w * scale) + border + "px";
    note.textContent = s.note + (scale < 1 ? ", achicado al " + Math.round(scale * 100) + " % para que entre" : "") +
      ". Es el sitio real: podés navegar y probar el carrito.";
  }

  document.querySelectorAll("[data-sv-view]").forEach(function (b) {
    b.addEventListener("click", function () {
      view = b.getAttribute("data-sv-view");
      document.querySelectorAll("[data-sv-view]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      stage.dataset.view = view;
      layout();
    });
  });
  window.addEventListener("resize", layout);
  layout();
})();
