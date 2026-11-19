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

---

# Estado físico (anthonymasyrubi.com/estado-fisico)

La página privada muestra actividad, entrenamientos, corazón y sueño con los datos de tu reloj. El camino es:

```
Reloj → su app → Health Connect → app HC Webhook → Worker (/health/ingest) → D1 → página
```

El servidor **solo guarda** pasos, distancia, calorías activas, pulso, pulso en reposo, VO₂ máx, sueño y entrenamientos. Cualquier otro dato que mande la app (peso, presión, glucosa, etc.) se ignora. La página no muestra horarios de sueño. Además de no aparecer en Google (`noindex`, fuera del sitemap y sin links desde el CV), el resumen requiere una clave privada: `noindex` por sí solo no protege datos.

## 1. Preparar el servidor

Dentro de `chat-worker`:

```bash
# Tablas nuevas (no toca las del chat)
npx wrangler d1 execute cv-chat --remote --file=schema.sql

# Generá claves aleatorias con este comando (una para cada secreto):
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"

# Clave para que solo tu celular pueda mandar datos.
npx wrangler secret put HEALTH_INGEST_KEY

# Clave aleatoria de al menos 32 caracteres para abrir la página privada; no la pongas en el código del sitio.
npx wrangler secret put HEALTH_VIEW_KEY

npx wrangler deploy
```

## 2. Revisar que tu reloj escriba en Health Connect

En el celular: **Configuración → Health Connect → Datos y acceso**. Entrá en Pasos y en Frecuencia cardíaca y fijate que haya datos de hoy y que la app de tu reloj figure en **Fuentes de datos**. Si no aparecen, en la app de tu reloj buscá la opción de sincronizar con Health Connect y activala.

## 3. Configurar HC Webhook

1. Instalá **HC Webhook** desde Google Play: https://play.google.com/store/apps/details?id=com.hcwebhook.app
2. Tocá **Grant Permissions** y dale acceso solo a: Pasos, Distancia, Calorías activas, Frecuencia cardíaca, Frecuencia cardíaca en reposo, VO₂ máx, Sueño y Ejercicio.
3. En **Webhooks**, agregá uno:
   - **URL:** `https://cv-chat.anthonymasyrubi.workers.dev/health/ingest`
   - **Delivery format:** JSON
   - **Custom header:** nombre `x-api-key`, valor = la clave que inventaste en el paso 1
4. **Tipos de datos y resolución:**
   - Pasos, Distancia y Calorías activas → **Daily**, con **Count overlapping apps once** activado, así no se suman dos veces si el celular y el reloj cuentan pasos a la vez.
   - Frecuencia cardíaca → **5 minutes**. Alcanza para la página y deja todo liviano.
5. **Sync mode:** Interval, **30 minutos**. Android no permite menos de 15.
6. Tocá **Test** y después **Sync Now**. En **Webhook Log** tiene que aparecer un **200** con algo como `"ok":true,"stored":{...}`.
7. En los ajustes del celular, sacá HC Webhook de la **optimización de batería**. Si no, Android puede frenar las sincronizaciones.

## 4. Ver la página

Abrí **anthonymasyrubi.com/estado-fisico/** e ingresá el valor que guardaste en `HEALTH_VIEW_KEY`. La clave solo se mantiene en memoria mientras la página está abierta; usa **Cerrar el panel** para ocultar los datos. Para ver el diseño con datos de ejemplo sin consultar el servidor, agregá `#demo` al final de la dirección.

## Si algo no anda

- **Webhook Log muestra 401:** la clave del encabezado `x-api-key` no coincide con `HEALTH_INGEST_KEY`.
- **El panel no acepta la clave:** revisá `HEALTH_VIEW_KEY` con `npx wrangler secret list` y, si hace falta, configurala de nuevo con `npx wrangler secret put HEALTH_VIEW_KEY`.
- **413:** llegaron demasiados datos juntos. Bajá la resolución del pulso a 5 minutos.
- **La página dice "Todavía no llegaron datos":** todavía no hubo una sincronización exitosa. Tocá Sync Now en la app.
- **Faltan pasos o sueño:** el reloj no los está escribiendo en Health Connect (ver paso 2).
- **Cambiar la zona horaria:** los días se cuentan en hora de Buenos Aires (UTC-3). Para otra zona, agregá `HEALTH_TZ_OFFSET_MIN = "-180"` en `[vars]` de `wrangler.toml` con tu diferencia en minutos.


# Métricas del sitio

## Descargas del PDF y conversaciones (Telegram)

Cada vez que alguien descarga el CV en PDF te llega un aviso silencioso a Telegram. En el bot, mandá `/stats` para ver descargas y conversaciones nuevas de hoy, de los últimos 7 días y de los últimos 30.

Se guarda solo un contador por día, tipo e idioma: nada del visitante. La tabla `events` se crea sola; no hace falta correr `schema.sql` otra vez.

## Visitas (Cloudflare Web Analytics)

1. En Cloudflare: **Analytics & Logs → Web Analytics → Add a site**, poné `anthonymasyrubi.com` y elegí la opción de agregar el script a mano (JS snippet).
2. Copiá el valor de `token` del snippet que te muestra.
3. Pegalo en `CF_TOKEN`, en `assets/analytics.js`, y subí el cambio.

El token no es secreto (queda en el HTML de cualquier sitio que lo usa). Es gratis y no usa cookies.
