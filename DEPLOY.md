# Cómo desplegar Marcolini

Guía paso a paso para poner la plataforma en producción. Está escrita
asumiendo que no eres desarrollador — cada paso dice exactamente dónde
hacer clic.

## El plan: Vercel + Vercel Postgres

- **Vercel** hospeda la aplicación (la empresa detrás de Next.js —
  configuración prácticamente automática, ideal si no quieres administrar
  un servidor).
- **Vercel Postgres** es la base de datos — se activa desde el mismo panel
  de Vercel, sin crear una cuenta aparte.

No hay costo para empezar (planes gratuitos de ambos alcanzan para el
lanzamiento); si el tráfico crece, se sube de plan desde el mismo panel.

## 1. El código ya está en GitHub (nada que hacer)

El proyecto vive en `github.com/jdiaz-ops/test1234`, en la rama
`claude/me-escuchas-ucxsdc` — esa es la rama por defecto del repositorio,
así que Vercel la va a detectar sola como la rama de producción. No hace
falta fusionarla a `main`.

## 2. Crea tu cuenta de Vercel

1. Ve a [vercel.com](https://vercel.com) → "Sign Up" → elige "Continue with
   GitHub" (usa la misma cuenta de GitHub del repositorio).
2. Autoriza a Vercel a acceder a tus repositorios.

## 3. Importa el proyecto

1. En el panel de Vercel: "Add New..." → "Project".
2. Busca `test1234` en la lista y dale "Import".
3. Vercel detecta que es Next.js automáticamente — no cambies nada en
   "Build and Output Settings" (ya viene configurado en el proyecto).
4. **Todavía no le des "Deploy"** — primero hay que conectar la base de
   datos y las variables de entorno (siguientes pasos).

## 4. Conecta la base de datos

1. Dentro del proyecto en Vercel, ve a la pestaña "Storage".
2. "Create Database" → elige "Postgres" (Neon) → dale un nombre (ej.
   `marcolini-db`) → "Create".
3. Vercel conecta la base automáticamente al proyecto y le agrega la
   variable `DATABASE_URL` sola — no tienes que copiarla a mano.

## 5. Variables de entorno

Ve a "Settings" → "Environment Variables" del proyecto y agrega estas
(la lista completa, con explicación de cada una, está en el archivo
`.env.example` del repositorio):

| Variable | De dónde sale |
|---|---|
| `AUTH_SECRET` | Genera un valor aleatorio largo — en tu computador puedes correr `openssl rand -base64 32`, o pídemelo y te genero uno. |
| `APP_URL` | Tu dominio real una vez lo tengas (ej. `https://marcolini.co`). Mientras tanto, usa la URL que te da Vercel al desplegar (`https://test1234.vercel.app`) y la actualizas después. |
| `CRON_SECRET` | Otro valor aleatorio — protege el proceso automático de cobros/pagos diarios. |
| `RESEND_API_KEY` | De [resend.com](https://resend.com) — para que los correos (verificación, recuperación de contraseña) salgan de verdad. Sin esto, el sistema sigue funcionando pero no manda correos reales. |
| `EPAYCO_PUBLIC_KEY` / `EPAYCO_PRIVATE_KEY` | De tu cuenta de ePayco — panel de ePayco → Integraciones. Sin esto, el Motor de Pagos queda en modo simulado (no cobra/paga de verdad, pero todo lo demás funciona igual para seguir probando). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Tu correo real y una contraseña que elijas — será tu cuenta de administrador. **Ponlas antes del primer paso 7 (sembrar la base)** — si las dejas vacías, se crea una cuenta de pruebas insegura. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Opcional — solo si quieres que la gente pueda entrar con "Continuar con Google". Se puede dejar vacío por ahora. |

No necesitas tocar `SHOPIFY_APP_API_KEY`/`SHOPIFY_APP_API_SECRET` — esas
son solo para el futuro, si Marcolini se registra como una app oficial de
Shopify. **Conectar la tienda Shopify de una marca es otra cosa, y no es
un paso de despliegue** — cada marca lo hace ella misma, ya con la app
funcionando, desde su Portal → Conexión de tienda (con su propio Access
Token de Shopify).

## 6. Despliega

Con la base y las variables listas, dale "Deploy". Vercel instala,
genera el cliente de Prisma, aplica las migraciones a tu base nueva, y
construye la app — todo automático (ya quedó configurado en el
proyecto). Toma 2-3 minutos.

## 7. Siembra los datos iniciales (una sola vez)

La plataforma necesita algunos datos base para arrancar (tu configuración
de tarifas, el vertical "Uñas" con sus categorías, y tu cuenta de admin).

**Forma más simple (recomendada) — un link, una sola vez:** confirma
primero que `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `CRON_SECRET` ya estén
puestos en las variables de entorno de Vercel (paso 5), y abre en el
navegador:

```
https://tu-app.vercel.app/api/admin/sembrar?secret=EL_VALOR_DE_TU_CRON_SECRET
```

Si responde `{"ok":true,...}`, ya quedó. Es seguro visitarlo más de una
vez (no duplica nada).

**Alternativa con el CLI de Vercel** (si prefieres hacerlo desde tu
computador, con Node.js instalado):

```bash
npm i -g vercel
vercel link          # conecta esta carpeta a tu proyecto de Vercel
vercel env pull       # baja las variables de entorno reales a .env
npx prisma db seed    # siembra la base de producción
```

## 8. Dominio propio (opcional, cuando quieras)

En "Settings" → "Domains" del proyecto, agrega tu dominio (ej.
`marcolini.co`) y sigue las instrucciones para apuntar el DNS — Vercel te
dice exactamente qué registro agregar en el proveedor donde compraste el
dominio. Después, actualiza la variable `APP_URL` con el dominio nuevo.

## 9. El proceso automático diario (cobros y pagos)

Ya está configurado en el código (`vercel.json`) para correr todos los
días a las 4am hora Colombia — no requiere que hagas nada más. Se conecta
solo una vez que despliegues.

---

## Checklist antes de invitar a tu primera marca real

- [ ] `ADMIN_EMAIL`/`ADMIN_PASSWORD` puestos con tus datos reales (no la
      cuenta de pruebas)
- [ ] Entraste al Panel Admin y revisaste Configuración (tarifa, IVA,
      días de cobro/pago)
- [ ] `RESEND_API_KEY` puesta (para que los correos de verificación
      lleguen de verdad)
- [ ] `EPAYCO_PUBLIC_KEY`/`EPAYCO_PRIVATE_KEY` puestas (si ya tienes la
      cuenta de ePayco lista)
- [ ] Revisaste el contenido legal (Panel Admin → Configuración →
      Contenido legal) — el de ejemplo dice "Contenido pendiente"

Cuando tengas tu cuenta de Vercel creada, dime y seguimos con el resto —
o si prefieres, dame las credenciales de una cuenta de Vercel que ya
tengas y avanzamos juntos.
