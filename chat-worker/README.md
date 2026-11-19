# Chat con IA del CV

El chat de anthonymasyrubi.com responde con Gemini usando la información de tu CV. Cada consulta te llega a Telegram al instante, y **si respondés el aviso desde Telegram, tu mensaje aparece en el chat del visitante en vivo**.

```
Visitante ⇄ chat del sitio ⇄ Worker de Cloudflare ⇄ Gemini
                                   ⇅
                               Telegram (vos)
```

Las claves quedan guardadas en Cloudflare, nunca en el código del sitio. Todo funciona dentro de los planes gratuitos.

Necesitás tener **Node.js** instalado. Son unos 20 minutos.

---

## 1. Crear el bot de Telegram

1. En Telegram, abrí **@BotFather** y mandale `/newbot`.
2. Elegí un nombre (por ejemplo "CV Anthony") y un usuario que termine en `bot`.
3. BotFather te da un **token** parecido a `123456789:AAH...`. Guardalo.
4. Abrí tu bot y mandale cualquier mensaje, por ejemplo "hola". **Es obligatorio:** un bot no puede escribirte si vos no le escribiste primero.
5. En el navegador, abrí esta dirección reemplazando `TU_TOKEN`:
   `https://api.telegram.org/botTU_TOKEN/getUpdates`
6. Buscá `"chat":{"id":` y copiá el número. Ese es tu **chat ID**.

## 2. Crear la clave de Gemini

1. Entrá a **aistudio.google.com** con tu cuenta de Google.
2. Tocá **Get API key → Create API key** y copiá la clave.

## 3. Publicar el Worker en Cloudflare

Creá una cuenta gratis en **dash.cloudflare.com**. Después, en una terminal, dentro de esta carpeta (`chat-worker`):

```bash
npm install
npx wrangler login
```

**Base de datos** (guarda tus respuestas hasta que el chat las muestra):

```bash
npx wrangler d1 create cv-chat
```

Copiá el `database_id` que te devuelve y pegalo en `wrangler.toml`, donde dice `PEGAR_ACA_EL_DATABASE_ID`. Después creá las tablas:

```bash
npx wrangler d1 execute cv-chat --remote --file=schema.sql
```

**Publicar:**

```bash
npx wrangler deploy
```

Al final aparece la dirección de tu Worker, parecida a `https://cv-chat.TU-SUBDOMINIO.workers.dev`.

**Claves.** Cada comando te pide pegar el valor:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

`TELEGRAM_WEBHOOK_SECRET` lo inventás vos: una contraseña larga de letras, números, `_` y `-` (por ejemplo `cv_chat_9f3k2LmQ7xT1`). Sirve para que nadie más pueda hacerse pasar por Telegram.

## 4. Conectar Telegram con el Worker

Abrí esta dirección en el navegador, reemplazando las tres partes en mayúsculas:

```
https://api.telegram.org/botTU_TOKEN/setWebhook?url=https://cv-chat.TU-SUBDOMINIO.workers.dev/telegram&secret_token=TU_WEBHOOK_SECRET
```

Tiene que responder `"ok":true`. Desde ese momento, lo que le respondas al bot llega al Worker.

## 5. Conectar el chat al sitio

En el repo del sitio, abrí `assets/chat.js` y completá esta línea con la dirección del Worker, agregando `/chat` al final:

```js
const CHAT_ENDPOINT = "https://cv-chat.TU-SUBDOMINIO.workers.dev/chat";
```

Hacé commit y probalo: escribí en el chat de tu sitio, te llega el aviso a Telegram, respondelo y mirá cómo aparece en el chat.

---

## Cómo se usa

- **Te llega un aviso por cada mensaje.** Muestra la pregunta, la respuesta de la IA y una etiqueta de conversación (`#s_...`). Tocando la etiqueta, Telegram te muestra todos los avisos de esa conversación.
- **Para contestar vos:** mantené apretado el aviso → **Responder** → escribí. Tu mensaje aparece en el chat del visitante en unos segundos, firmado como "Anthony". Telegram le pone 👍 a tu mensaje para confirmarte que se entregó.
- **Mientras contestás vos, la IA se pausa.** Los mensajes nuevos del visitante te llegan marcados con 🙋, sin respuesta de la IA.
- **Para devolverle la conversación a la IA:** respondé `/ia` a cualquier aviso de esa conversación. Si no hacés nada, la IA retoma sola a los 30 minutos (se cambia en `HUMAN_MINUTES`).
- Los avisos marcan 🆕 si es una conversación nueva, 📇 si alguien dejó un email o teléfono, y ⚠️ si la IA no pudo responder.
- El visitante ve tus respuestas mientras tenga la pestaña abierta. Si cerró la ventana del chat pero sigue en el sitio, el botón le muestra un contador de mensajes nuevos.

## Mantenimiento

- **Si cambiás tu CV:** actualizá `src/profile.js` y corré `npx wrangler deploy`. La IA solo sabe lo que está en ese archivo.
- **Si la IA dice algo que no te gusta:** ajustá las reglas en `RULES`, dentro de `src/profile.js`.
- **Para ver errores en vivo:** `npx wrangler tail`.
- **Para cambiar el modelo:** editá `GEMINI_MODEL` en `wrangler.toml`. `gemini-flash-latest` apunta siempre al Flash vigente.
- **Si sumás otro dominio:** agregalo en `ALLOWED_ORIGINS` en `wrangler.toml`.

## Protecciones incluidas

- Solo acepta pedidos desde tus dominios, y solo acepta mensajes de Telegram que traigan tu secreto y vengan de tu chat.
- Hasta 8 mensajes por minuto por visitante y 25 por conversación. Corta los mensajes a 800 caracteres.
- Si Gemini falla o se queda sin cupo, el visitante recibe tu email y a vos te llega el aviso igual.
- Si la base de datos no está configurada, la IA sigue respondiendo; solo se desactivan las respuestas desde Telegram.

## Privacidad

En el plan gratuito, Google puede usar lo que se envía a Gemini para mejorar sus productos. El chat avisa que responde una IA, y cuando contestás vos, avisa que el visitante está hablando con vos.
