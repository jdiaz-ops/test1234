# Landings guardadas

Versiones de las landings que Juan pidió guardar para poder volver a ellas
en cualquier momento.

## 3 de octubre de 2026

Commit: `7bc43287cebccc151b029439de4d4a2d0b877098`
(rama `claude/me-escuchas-ucxsdc`, "Muestras escondidas otra vez para arrancar")

Cómo estaban:

- **Inicio (`/`)**: titular de marcas "Tu próxima venta puede venir de un
  creador de contenido", sin la frase "Habilitamos relaciones…".
- **/para-creadores**: botones a la lista de espera; sin checklist en el
  hero, sin campañas, sin muestras, sin el botón de la sección de vitrina;
  ejemplo de link `valentina.marcolini.lat`.
- **/para-marcas**: botones a la lista de espera de marcas; confianza solo
  "Sin mensualidades"; sin simulador, sin ROI, sin campañas, sin muestras.
- **Lista de espera de creadores** y **de marcas**: formularios con
  Instagram, TikTok (y Web en marcas) en líneas separadas + "Agregar otra
  red".

Archivos:

```
src/app/page.tsx
src/app/para-creadores/page.tsx
src/app/para-marcas/page.tsx
src/app/(auth)/lista-de-espera/page.tsx
src/app/(auth)/lista-de-espera/marcas/page.tsx
src/components/marketing/
```

Ojo: lo que se ve también depende de los interruptores de
`src/lib/features.ts` (muestras, campañas, referidos). En esta versión
todos estaban apagados.

Para restaurarlas (pedírselo a Claude, o con git):

```
git checkout 7bc43287cebccc151b029439de4d4a2d0b877098 -- \
  src/app/page.tsx src/app/para-creadores/page.tsx src/app/para-marcas/page.tsx \
  "src/app/(auth)/lista-de-espera" src/components/marketing
```
