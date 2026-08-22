# Cuando compres un dominio propio

Hoy la app vive en `https://test1234-five-beta.vercel.app`. El día que compres un
dominio propio (ej. `marcolini.co`), ese cambio **no es automático** — hay que
actualizarlo a mano en varios lugares. Esta es la lista completa:

## 1. Vercel — conectar el dominio

- Proyecto → **Settings → Domains** → agregar el dominio nuevo y seguir las
  instrucciones de DNS que te dé Vercel (apuntar el dominio ahí).

## 2. Variable de entorno `APP_URL`

- Vercel → **Settings → Environment Variables** → editar `APP_URL` para que
  apunte al dominio nuevo (ej. `https://marcolini.co`).
- Esta variable es la única fuente de verdad que usa el código para armar los
  links de los correos (verificación, recuperar contraseña) y las URLs de
  webhook de Shopify/WooCommerce — al cambiarla, esos links se actualizan
  solos, no hay que tocar código.
- Redeploy después de guardarla (igual que hicimos con el Blob).

## 3. Resend (correo transaccional)

- Resend → **Domains → Add Domain** → verificar el dominio nuevo (agrega los
  registros DNS que te pida).
- Una vez verificado, actualizar `EMAIL_FROM` en Vercel para que use ese
  dominio (ej. `Marcolini <no-reply@marcolini.co>`).

## 4. Shopify — Dev Dashboard

- `dev.shopify.com` → tu app "Marcolini" → **Versions** → editar:
  - **App URL**: `https://marcolini.co/marca`
  - **Allowed redirection URL(s)**: `https://marcolini.co/api/integrations/shopify/callback`
- Hay que crear una nueva versión y darle **Release** para que el cambio
  quede activo.

## 5. Google (inicio de sesión con Google)

- Google Cloud Console → tu proyecto → **APIs & Services → Credentials** →
  el Client ID de OAuth que usa Marcolini → agregar el nuevo **Authorized
  redirect URI**: `https://marcolini.co/api/auth/callback/google`.
- No borres la URL vieja de una vez — dejar las dos mientras confirmas que
  todo funciona, y solo después quitar la del dominio viejo.

## 6. WooCommerce

- No aplica — WooCommerce no requiere registrar la URL de redirección por
  adelantado en ningún panel externo (el flujo de autorización la recibe en
  el momento, no antes). Con actualizar `APP_URL` (punto 2) ya queda
  cubierto.
