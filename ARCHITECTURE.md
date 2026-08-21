# Arquitectura de Marcolini — decisiones y por qué

Este documento existe para que cualquier sesión futura de construcción (o
cualquier desarrollador que se sume) entienda las decisiones tomadas y no las
reconstruya distinto por accidente.

## Multi-cliente desde el diseño: web hoy, apps móviles después

El usuario pidió explícitamente que, aunque hoy solo se construye la web, todo
quede pensado para que **más adelante exista una app de celular (iOS y
Android)** para el Portal Creador y el Portal Marca (el Panel Admin es menos
prioritario en móvil, pero no se descarta).

Para que ese salto no obligue a reconstruir el backend, se siguen estas
reglas desde el día 1:

1. **Autenticación basada en JWT (token), no solo en sesión de cookie de
   navegador.** Auth.js se configura con `session.strategy: "jwt"`. Un token
   JWT lo puede usar tanto el navegador como una futura app nativa — una
   sesión de base de datos ligada a cookies de navegador no viaja bien a
   móvil.

2. **Toda la lógica de negocio vive en una capa de servicios separada de la
   interfaz** (`src/server/services/*`), nunca embebida directamente dentro
   de componentes de página. Las páginas web llaman a esos servicios a través
   de rutas de API (`src/app/api/**`) — nunca lógica de negocio dentro de un
   componente React. Así, el mismo servicio se expone después a una app móvil
   sin duplicar nada.

3. **Cuando llegue el momento de construir la app móvil**, la opción recomendada
   es **React Native (vía Expo)** — mismo lenguaje (TypeScript) y mismos
   patrones que ya se usan en la web, así que no es una reconstrucción desde
   cero, es una extensión. Se evaluaría reorganizar el repo como un monorepo
   (web + app móvil + paquete de API compartido) en ese momento — no antes,
   para no añadir complejidad hoy sin necesidad.

4. **Notificaciones**: el modelo `Notification` ya existe para las
   notificaciones internas de cada portal. Cuando exista la app móvil, se
   añadirá un modelo `DeviceToken` (ya incluido desde ahora en el esquema,
   sin usar todavía) para enviar notificaciones push reales a los celulares.

## Lo que esto NO significa todavía

- No se está construyendo la app móvil ahora.
- No se está armando un monorepo todavía — eso se evalúa cuando la app móvil
  entre en construcción real.
- No se añade complejidad de infraestructura extra hoy — solo se toman las
  decisiones de bajo costo que evitan tener que rehacer trabajo después.
