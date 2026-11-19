/*
 * Chat del CV: ventana "Nuevo mensaje".
 * Responde una IA con la información del CV, avisa a Anthony por Telegram,
 * y si Anthony responde desde Telegram, su mensaje aparece acá en vivo.
 *
 * Pegá acá la URL de tu Worker de Cloudflare, terminada en /chat.
 * Mientras esté vacía, el chat muestra un mensaje con tu email en lugar de responder con IA.
 */
const CHAT_ENDPOINT = "https://cv-chat.anthonymasyrubi.workers.dev/chat";

(function () {
  const T = {
    es: {
      fab: "Escribime ahora", title: "Nuevo mensaje", to: "Para: Anthony Mas y Rubi",
      note: "Responde una IA con la información de mi CV. Yo leo todos los mensajes.",
      noteHuman: "Estás hablando con Anthony.",
      hello: "Hola, soy Anthony. Preguntame lo que quieras sobre mi experiencia o cómo trabajo. Si querés que te contacte, dejame tu email.",
      you: "Vos", ai: "Anthony (IA)", human: "Anthony", typing: "Anthony está escribiendo…",
      sentHuman: "Anthony recibió tu mensaje.",
      placeholder: "Escribí tu consulta…", send: "Enviar", close: "Cerrar chat", unread: "mensajes nuevos de Anthony",
      offline: "El chat con IA todavía no está conectado. Escribime a ajmercato@gmail.com y te respondo personalmente.",
      error: "No pude enviar tu mensaje. Revisá tu conexión, o escribime a ajmercato@gmail.com.",
      slow: "Está tardando más de lo normal. Tu mensaje igual me llegó; probá de nuevo en un rato o escribime a ajmercato@gmail.com.",
      suggest: ["¿Qué experiencia tenés con Salesforce Marketing Cloud?", "¿Buscás empleo o tomás freelance?", "¿Cómo te contacto?"],
    },
    en: {
      fab: "Message me", title: "New message", to: "To: Anthony Mas y Rubi",
      note: "An AI answers using my CV. I read every message.",
      noteHuman: "You're talking with Anthony.",
      hello: "Hi, I'm Anthony. Ask me anything about my experience or how I work. If you'd like me to reach out, leave your email.",
      you: "You", ai: "Anthony (AI)", human: "Anthony", typing: "Anthony is typing…",
      sentHuman: "Anthony got your message.",
      placeholder: "Type your question…", send: "Send", close: "Close chat", unread: "new messages from Anthony",
      offline: "The AI chat isn't connected yet. Write to me at ajmercato@gmail.com and I'll answer personally.",
      error: "I couldn't send your message. Check your connection, or write to me at ajmercato@gmail.com.",
      slow: "This is taking longer than usual. I still got your message; try again in a bit or write to me at ajmercato@gmail.com.",
      suggest: ["What's your Salesforce Marketing Cloud experience?", "Are you looking for a job or freelance work?", "How can I contact you?"],
    },
  };
  const lang = () => (document.documentElement.lang || "es").startsWith("en") ? "en" : "es";
  const t = k => T[lang()][k];

  /* ---------- estado (persiste mientras la pestaña está abierta) ---------- */
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  function newSession() {
    const a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 256));
    return Array.from(a, b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  }
  let session = ss.get("cv-chat-session");
  if (!/^[a-z0-9]{16}$/.test(session || "")) { session = newSession(); ss.set("cv-chat-session", session); }
  let messages = ss.get("cv-chat-messages") || [];
  let lastId = ss.get("cv-chat-last") || 0;
  let human = !!ss.get("cv-chat-human");
  let unread = 0, busy = false, status = "", lastActivity = Date.now(), pollTimer = null;

  const save = () => { ss.set("cv-chat-messages", messages); ss.set("cv-chat-last", lastId); ss.set("cv-chat-human", human); };

  /* ---------- interfaz ---------- */
  const icon = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 16.5V13L12.5 3.5a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L6.5 16.5H3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 5l4 4" stroke="currentColor" stroke-width="1.6"/></svg>';
  const fab = document.createElement("button");
  fab.type = "button"; fab.className = "chat-fab";
  fab.setAttribute("aria-haspopup", "dialog"); fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-controls", "cv-chat");
  fab.innerHTML = icon + '<span class="chat-fab-label"></span><span class="chat-badge" hidden></span>';

  const box = document.createElement("section");
  box.className = "chat"; box.id = "cv-chat"; box.hidden = true;
  box.setAttribute("role", "dialog"); box.setAttribute("aria-labelledby", "cv-chat-title");
  box.innerHTML = `
    <header class="chat-head">
      <div><p class="chat-title" id="cv-chat-title"></p><p class="chat-to"></p></div>
      <button type="button" class="chat-close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>
    </header>
    <p class="chat-note"></p>
    <div class="chat-log" aria-live="polite"></div>
    <div class="chat-suggest"></div>
    <form class="chat-form">
      <textarea rows="1" maxlength="800" aria-label=""></textarea>
      <button type="submit" class="chat-send"></button>
    </form>`;
  document.body.append(fab, box);

  const $ = s => box.querySelector(s);
  const log = $(".chat-log"), form = $(".chat-form"), input = $("textarea"), sendBtn = $(".chat-send"), suggest = $(".chat-suggest");
  const badge = fab.querySelector(".chat-badge");

  function labels() {
    fab.querySelector(".chat-fab-label").textContent = t("fab");
    $(".chat-title").textContent = t("title");
    $(".chat-to").textContent = t("to");
    $(".chat-close").setAttribute("aria-label", t("close"));
    input.placeholder = t("placeholder"); input.setAttribute("aria-label", t("placeholder"));
    sendBtn.textContent = t("send");
    render();
  }

  function linkify(el, text) {
    text.split(/(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g).forEach(part => {
      if (/^https?:\/\//.test(part)) {
        const a = document.createElement("a"); a.href = part.replace(/[.,)]+$/, ""); a.textContent = part; a.target = "_blank"; a.rel = "noopener"; el.appendChild(a);
      } else if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(part)) {
        const a = document.createElement("a"); a.href = "mailto:" + part; a.textContent = part; el.appendChild(a);
      } else el.appendChild(document.createTextNode(part));
    });
  }

  function bubble(m) {
    const div = document.createElement("div");
    div.className = "chat-msg chat-" + m.role + (m.human ? " chat-human" : "");
    const who = document.createElement("p"); who.className = "chat-who";
    who.textContent = m.role === "user" ? t("you") : (m.human ? t("human") : t("ai"));
    const body = document.createElement("p"); body.className = "chat-text";
    linkify(body, m.content);
    div.append(who, body);
    return div;
  }

  function render() {
    const note = $(".chat-note");
    note.textContent = human ? t("noteHuman") : t("note");
    note.classList.toggle("is-human", human);
    log.innerHTML = "";
    log.appendChild(bubble({ role: "assistant", content: t("hello") }));
    messages.forEach(m => log.appendChild(bubble(m)));
    if (busy || status) {
      const p = document.createElement("p"); p.className = "chat-typing";
      p.textContent = busy ? t("typing") : t(status);
      log.appendChild(p);
    }
    suggest.innerHTML = "";
    suggest.hidden = messages.length > 0;
    if (!messages.length) t("suggest").forEach(q => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = q;
      b.addEventListener("click", () => send(q));
      suggest.appendChild(b);
    });
    badge.hidden = !unread;
    badge.textContent = unread;
    badge.setAttribute("aria-label", unread + " " + t("unread"));
    log.scrollTop = log.scrollHeight;
  }

  /* ---------- enviar ---------- */
  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    messages.push({ role: "user", content: text.slice(0, 800) });
    save(); lastActivity = Date.now(); status = "";
    input.value = ""; autosize();
    busy = !human; sendBtn.disabled = true; render();

    let reply = null;
    if (!CHAT_ENDPOINT) {
      await new Promise(r => setTimeout(r, 500));
      reply = t("offline");
    } else {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 40_000);
      try {
        const res = await fetch(CHAT_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
          body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), lang: lang(), session, page: location.pathname }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.human) { human = true; status = "sentHuman"; }
        else { if (res.ok) human = false; reply = data.reply || t("error"); }
      } catch (e) {
        reply = e && e.name === "AbortError" ? t("slow") : t("error");
      } finally { clearTimeout(timer); }
      startPolling();
    }
    if (reply) messages.push({ role: "assistant", content: reply });
    save();
    busy = false; sendBtn.disabled = false; render();
    input.focus();
  }

  /* ---------- respuestas de Anthony desde Telegram ---------- */
  async function poll() {
    if (!CHAT_ENDPOINT || !messages.length) return;
    try {
      const res = await fetch(`${CHAT_ENDPOINT}/updates?session=${session}&after=${lastId}`);
      if (!res.ok) return;
      const data = await res.json();
      const fresh = (data.messages || []).filter(m => m.id > lastId);
      const wasHuman = human;
      human = !!data.human;
      if (fresh.length) {
        fresh.forEach(m => messages.push({ role: "assistant", content: m.content, human: true }));
        lastId = fresh[fresh.length - 1].id;
        lastActivity = Date.now();
        status = "";
        if (box.hidden) unread += fresh.length;
      }
      if (fresh.length || wasHuman !== human) { save(); render(); }
    } catch (e) { /* sin conexión: se reintenta en el próximo ciclo */ }
  }

  function startPolling() {
    if (pollTimer || !CHAT_ENDPOINT) return;
    const tick = async () => {
      const idle = Date.now() - lastActivity > 30 * 60_000;
      if (idle) { pollTimer = null; return; }
      if (document.visibilityState === "visible") await poll();
      pollTimer = setTimeout(tick, box.hidden ? 10_000 : 4_000);
    };
    pollTimer = setTimeout(tick, 1_500);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && messages.length) { lastActivity = Date.now(); startPolling(); poll(); } });

  /* ---------- abrir / cerrar ---------- */
  function autosize() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; }
  function open() {
    box.hidden = false; fab.setAttribute("aria-expanded", "true"); document.documentElement.classList.add("chat-open");
    unread = 0; render(); setTimeout(() => input.focus(), 30);
    if (messages.length) { lastActivity = Date.now(); poll(); startPolling(); }
  }
  function close() {
    box.hidden = true; fab.setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("chat-open");
    fab.focus();
  }

  fab.addEventListener("click", () => (box.hidden ? open() : close()));
  $(".chat-close").addEventListener("click", close);
  box.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  form.addEventListener("submit", e => { e.preventDefault(); send(input.value); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  input.addEventListener("input", autosize);
  document.querySelectorAll("[data-open-chat]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); open(); }));

  new MutationObserver(labels).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  labels();
  if (messages.length) startPolling();
})();
