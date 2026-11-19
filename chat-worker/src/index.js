/*
 * Chat del CV de Anthony Mas y Rubi.
 *
 * POST /chat           El visitante escribe. Responde Gemini (o nadie, si Anthony tomó la conversación)
 *                      y se avisa a Anthony por Telegram.
 * GET  /chat/updates   El chat del sitio pregunta si Anthony respondió desde Telegram.
 * POST /telegram       Webhook de Telegram: las respuestas de Anthony a un aviso llegan acá.
 *
 * Secretos (npx wrangler secret put ...):
 *   GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
 * Variables (wrangler.toml): ALLOWED_ORIGINS, GEMINI_MODEL, HUMAN_MINUTES
 * Base de datos (wrangler.toml): DB  →  ver schema.sql
 */
import { PROFILE, RULES } from "./profile.js";

const MAX_MESSAGES = 20;          // turnos de historial que se mandan a la IA
const MAX_CHARS = 800;            // largo máximo de cada mensaje del visitante
const MAX_TURNS_PER_SESSION = 25;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;               // mensajes por minuto por IP (por instancia)
const SESSION_RE = /^[a-z0-9]{8,24}$/;
const TAG_RE = /#s_([a-z0-9]{8,24})/;
const CONTACT_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\+?\d[\d\s().-]{7,}\d/;

const hits = new Map();
const now = () => Date.now();

/* ---------------- utilidades HTTP ---------------- */

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    ok: allowed.includes(origin),
    headers: {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  };
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });

function rateLimited(ip) {
  const t = now();
  const list = (hits.get(ip) || []).filter(x => t - x < RATE_WINDOW_MS);
  list.push(t);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_MAX;
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? MAX_CHARS : 2000) }))
    .filter(m => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return { recent: msgs.slice(-MAX_MESSAGES), turn: msgs.filter(m => m.role === "user").length };
}

/* ---------------- base de datos (D1) ---------------- */

async function humanActive(env, session) {
  if (!env.DB) return false;
  const row = await env.DB.prepare("SELECT human_until FROM sessions WHERE id = ?").bind(session).first();
  return !!row && row.human_until > now();
}

async function setHuman(env, session, untilMs) {
  await env.DB.prepare(
    "INSERT INTO sessions (id, human_until, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET human_until = excluded.human_until, updated_at = excluded.updated_at"
  ).bind(session, untilMs, now()).run();
}

async function addReply(env, session, content) {
  await env.DB.prepare("INSERT INTO replies (session, content, created_at) VALUES (?, ?, ?)")
    .bind(session, content, now()).run();
}

async function repliesAfter(env, session, after) {
  const { results } = await env.DB.prepare(
    "SELECT id, content, created_at FROM replies WHERE session = ? AND id > ? ORDER BY id LIMIT 20"
  ).bind(session, after).all();
  return results || [];
}

/* ---------------- Gemini ---------------- */

async function askGemini(env, messages, lang) {
  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    system_instruction: {
      parts: [{ text: `${RULES}\nIdioma de la interfaz del visitante: ${lang === "en" ? "inglés" : "español"}.\n\nPERFIL\n${PROFILE}` }],
    },
    contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter(p => !p.thought && typeof p.text === "string").map(p => p.text).join("").trim();
  if (!text) throw new Error("Gemini devolvió una respuesta vacía");
  return text;
}

/* ---------------- Telegram ---------------- */

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tg(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  return res;
}

async function notify(env, { session, page, lang, question, answer, turn, error, human }) {
  if (!env.TELEGRAM_CHAT_ID) return;
  const flags = [];
  if (turn === 1) flags.push("🆕 Nueva conversación");
  if (CONTACT_RE.test(question)) flags.push("📇 Dejó un contacto");
  if (error) flags.push("⚠️ La IA no pudo responder");
  if (human) flags.push("🙋 Estás respondiendo vos");

  const lines = [
    flags.length ? `<b>${flags.join(" · ")}</b>` : null,
    `💬 #s_${session} · ${lang.toUpperCase()} · ${esc(page)} · mensaje ${turn}`,
    "",
    `👤 ${esc(question)}`,
  ];
  if (human) lines.push("", "<i>La IA está en pausa. Respondé este mensaje para contestarle.</i>");
  else if (error) lines.push("", `⚠️ ${esc(error)}`);
  else lines.push("", `🤖 ${esc(answer)}`);
  if (turn === 1 && !human) lines.push("", "<i>Respondé este mensaje para contestarle vos.</i>");

  await tg(env, "sendMessage", {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: lines.filter(l => l !== null).join("\n").slice(0, 4000),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

async function handleTelegram(request, env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET ||
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }
  const update = await request.json().catch(() => null);
  const msg = update?.message;
  // Siempre 200 para que Telegram no reintente; solo actuamos sobre tus mensajes.
  if (!msg || String(msg.chat?.id) !== String(env.TELEGRAM_CHAT_ID) || typeof msg.text !== "string") {
    return new Response("ok");
  }

  const replyTo = msg.reply_to_message;
  const tag = replyTo && (replyTo.text || replyTo.caption || "").match(TAG_RE);
  if (!tag) {
    await tg(env, "sendMessage", {
      chat_id: env.TELEGRAM_CHAT_ID,
      text: "Para contestarle a un visitante, respondé (Reply) al aviso de su mensaje.\nPara que vuelva a responder la IA, respondé /ia a un aviso.",
    });
    return new Response("ok");
  }

  const session = tag[1];
  const text = msg.text.trim();

  if (text === "/ia" || text.startsWith("/ia@")) {
    await setHuman(env, session, 0);
    await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, text: `🤖 La IA vuelve a responder en #s_${session}`, reply_to_message_id: msg.message_id });
    return new Response("ok");
  }

  await addReply(env, session, text.slice(0, 2000));
  await setHuman(env, session, now() + (Number(env.HUMAN_MINUTES) || 30) * 60_000);
  await tg(env, "setMessageReaction", {
    chat_id: env.TELEGRAM_CHAT_ID, message_id: msg.message_id,
    reaction: [{ type: "emoji", emoji: "👍" }],
  });
  return new Response("ok");
}

/* ---------------- rutas ---------------- */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/telegram" && request.method === "POST") return handleTelegram(request, env);

    const cors = corsHeaders(request.headers.get("Origin") || "", env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });

    /* El chat pregunta si respondiste desde Telegram */
    if (url.pathname === "/chat/updates" && request.method === "GET") {
      if (!cors.ok) return json({ error: "forbidden_origin" }, 403, cors.headers);
      const session = url.searchParams.get("session") || "";
      if (!SESSION_RE.test(session) || !env.DB) return json({ messages: [], human: false }, 200, cors.headers);
      const after = Math.max(0, parseInt(url.searchParams.get("after") || "0", 10) || 0);
      const [messages, human] = await Promise.all([repliesAfter(env, session, after), humanActive(env, session)]);
      return json({ messages, human }, 200, cors.headers);
    }

    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "not_found" }, 404, cors.headers);
    if (!cors.ok) return json({ error: "forbidden_origin" }, 403, cors.headers);
    if (rateLimited(request.headers.get("CF-Connecting-IP") || "unknown")) return json({ error: "rate_limited" }, 429, cors.headers);

    const payload = await request.json().catch(() => null);
    const cleaned = payload && cleanMessages(payload.messages);
    if (!cleaned) return json({ error: "bad_request" }, 400, cors.headers);

    const { recent: messages, turn } = cleaned;
    const lang = payload.lang === "en" ? "en" : "es";
    const session = SESSION_RE.test(payload.session || "") ? payload.session : "anon";
    const page = String(payload.page || "/").slice(0, 80);
    const question = messages[messages.length - 1].content;
    const info = { session, page, lang, question, turn };

    // Si estás respondiendo vos, la IA no contesta: solo te llega el aviso.
    if (await humanActive(env, session)) {
      ctx.waitUntil(notify(env, { ...info, human: true }));
      return json({ reply: null, human: true }, 200, cors.headers);
    }

    if (turn > MAX_TURNS_PER_SESSION) {
      const reply = lang === "en"
        ? "We've covered a lot here. To keep talking, write to me at ajmercato@gmail.com and I'll answer personally."
        : "Ya hablamos bastante por acá. Para seguir, escribime a ajmercato@gmail.com y te respondo personalmente.";
      return json({ reply }, 200, cors.headers);
    }

    try {
      const reply = await askGemini(env, messages, lang);
      ctx.waitUntil(notify(env, { ...info, answer: reply }));
      return json({ reply }, 200, cors.headers);
    } catch (err) {
      ctx.waitUntil(notify(env, { ...info, error: err.message }));
      const busy = err.status === 429;
      const reply = lang === "en"
        ? (busy ? "Lots of messages right now. " : "") + "I couldn't answer that just now, but I got your message. You can also write to me at ajmercato@gmail.com."
        : (busy ? "Hay muchas consultas en este momento. " : "") + "No pude responder ahora, pero tu mensaje me llegó. También podés escribirme a ajmercato@gmail.com.";
      return json({ reply, degraded: true }, 200, cors.headers);
    }
  },
};
