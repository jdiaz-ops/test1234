import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  IconStore,
  IconArrowRight,
  IconCheck,
} from "@/components/marketing/icons";

// Datos de ejemplo para las vistas previas de la sección "Así funciona en tu
// panel" — la misma info y el mismo tratamiento visual (colores, tipos,
// tiles) que ya existen de verdad en el portal de marca (ver
// challenge-results-grid.tsx y challenges-panel.tsx), solo con cifras de
// muestra. Nada inventado que la marca no tenga hoy: ni integraciones con
// Google Analytics/Facebook Pixel ni nada por el estilo. "Red de creadores"
// se describe como comunidad a la que se accede (así se describe también en
// "Beneficios" más abajo) — Marcolini no tiene un buscador/directorio donde
// la marca navega y elige creadores, son los creadores quienes descubren y
// se unen a las marcas desde su propio marketplace.
const previewIntegraciones = [
  { nombre: "Shopify", conectada: true },
  { nombre: "WooCommerce", conectada: false },
];

const previewRedCreadores = [
  { name: "Valentina R.", especialidad: "Uñas" },
  { name: "Camila M.", especialidad: "Skincare" },
  { name: "Sofía T.", especialidad: "Maquillaje" },
  { name: "Laura G.", especialidad: "Belleza" },
];

const previewCreadores = [
  { name: "Valentina R.", code: "VALE20", ventas: "32 ventas" },
  { name: "Camila M.", code: "CAMI20", ventas: "18 ventas" },
  { name: "Sofía T.", code: "SOFIA20", ventas: "9 ventas" },
];

const previewParticipantes = [
  { name: "Valentina R.", status: "Logró la meta", ok: true },
  { name: "Camila M.", status: "En camino", ok: false },
];

const previewTransacciones = [
  { creador: "Valentina R.", fecha: "12 ago", venta: "$189.000", estado: "Pagado" },
  { creador: "Camila M.", fecha: "11 ago", venta: "$95.000", estado: "Aprobado" },
  { creador: "Sofía T.", fecha: "10 ago", venta: "$210.000", estado: "En revisión" },
];

export default function ParaMarcasPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero — dos columnas (texto + visual), no todo centrado y gigante
            como antes. Referencia: impact.com/affiliate-marketing (texto a
            la izquierda más comedido, mockup real a la derecha). El visual
            de la derecha es la tarjeta real de "Creadores de tu marca" que
            ya existe en "Así funciona en tu panel" más abajo — no una
            ilustración inventada, ni la misma tarjeta de ROI que ya se ve
            más abajo (para no repetir el mismo ejemplo dos veces en la
            misma página). */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-20 h-[420px] w-[560px] rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
          />
          <div className="relative max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-14 items-center">
            <div>
              {/* Logos reales en vez de texto. En blanco/neutro (no en el
                  rosado de las demás píldoras) para que el morado de
                  WooCommerce no choque con el acento de la página. Altura
                  fija + ancho automático en cada logo (no al revés) porque
                  los dos vienen con proporciones muy distintas — Shopify es
                  un lockup ancho y bajo, WooCommerce viene apilado (globo +
                  wordmark), más cuadrado. El de Shopify llegó en blanco puro
                  (pensado para fondos oscuros) — brightness(0) lo vuelve
                  negro sólido, que sí se lee sobre este fondo claro.
                  WooCommerce usa grayscale en vez de brightness(0) porque
                  tiene blanco Y morado a la vez (el brightness(0) fundiría
                  las letras "Woo" blancas con el fondo, volviéndolas
                  ilegibles) — el grayscale conserva ese contraste de tono. */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-4 bg-brand-surface border border-brand-line rounded-full px-5 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/, altura fija con filtro de color */}
                  <img src="/shopify.webp" alt="Shopify" className="h-4 w-auto" style={{ filter: "brightness(0)" }} />
                  <span aria-hidden className="h-5 w-px bg-brand-line" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/, altura fija con filtro de color */}
                  <img src="/Woocommerce.png" alt="WooCommerce" className="h-6 w-auto" style={{ filter: "grayscale(1)" }} />
                </div>
              </div>
              {/* Vuelve al tamaño de dos rondas atrás — el +20% de la ronda
                  anterior lo hizo demasiado grande otra vez. */}
              <h1 className="font-display text-2xl sm:text-4xl font-semibold text-brand-ink mb-5 text-balance leading-[1.15]">
                Crece tu e‑commerce conectando tu marca con nuestra red de creadores de contenido
              </h1>
              <p className="text-brand-accent text-lg sm:text-xl font-semibold mb-8 text-balance max-w-lg">
                Sin mensualidades.
                <br />
                Solo pagas comisión cuando generan ventas
              </p>
              <Link
                href="/registro/marca"
                className="group inline-flex items-center justify-center gap-2 bg-brand-accent text-white rounded-full px-10 py-5 text-base font-medium hover:opacity-90 transition shadow-[0_10px_30px_-10px_var(--brand-accent)]"
              >
                Crear mi programa gratis
                <IconArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Composición con 2 tarjetas satélite (estilo impact.com):
                la principal es el resultado real de una campaña; las dos
                pequeñas ilustran, con nuestro propio lenguaje visual (no
                fotos ni íconos inventados), lo que ofrecemos — creadores
                ya conectados a tu marca, y el efecto en las ventas de tu
                e-commerce. Padding generoso alrededor (py-8 en el wrapper)
                para que las satélites, que sobresalen del borde de la
                tarjeta principal, tengan espacio y no se corten contra el
                borde de la sección. */}
            <div className="py-8 px-6">
              {/* Las satélites se anclan a ESTE contenedor (del tamaño
                  real de la tarjeta, max-w-sm), no al wrapper de afuera
                  (que es tan ancho como toda la columna) — si no, al
                  agrandar la tarjeta sus bordes terminan tapados por las
                  satélites en vez de sobresalir de ellos.
                  max-w-sm (antes max-w-xl) + padding/tipografía un
                  escalón más chicos: comparado con impact.com, donde el
                  texto del H1 domina y la ilustración de la derecha es
                  secundaria, esta tarjeta se veía demasiado grande frente
                  a la columna de texto. */}
              <div className="relative max-w-sm mx-auto">
              {/* Sigue siendo la tarjeta más grande de la composición
                  (domina sobre las 2 satélites, como en impact.com), pero
                  todo el bloque se achicó para no competir con el texto
                  del lado izquierdo. */}
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-5 sm:p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.2)]">
                <p className="text-xs text-brand-ink-soft mb-2.5">Resultado de la campaña</p>
                <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-2.5">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="font-display text-2xl font-bold text-brand-accent">3.8x</p>
                    <p className="text-xs text-brand-ink-soft">por cada $1 invertido, generaste 3.8x en ventas</p>
                  </div>
                  <p className="text-sm text-brand-ink font-medium mt-1">
                    Esta campaña rindió bien — vale la pena repetirla.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-brand-bg px-3 py-2">
                    <p className="font-mono text-base font-medium text-brand-ink leading-tight">$4.200.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Ventas generadas</p>
                  </div>
                  <div className="rounded-lg bg-brand-bg px-3 py-2">
                    <p className="font-mono text-base font-medium text-brand-ink leading-tight">54</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Órdenes</p>
                  </div>
                  <div className="rounded-lg bg-brand-bg px-3 py-2">
                    <p className="font-mono text-base font-medium text-brand-ink leading-tight">$200.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Bono total otorgado</p>
                  </div>
                  <div className="rounded-lg bg-brand-bg px-3 py-2">
                    <p className="font-mono text-base font-medium text-brand-ink leading-tight">$900.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Comisión total generada</p>
                  </div>
                </div>
              </div>

              {/* Satélite 1 — "hay creadores, ya están conectados a tu
                  marca". Reusa el chip de iniciales que ya se ve en el
                  bloque de "Creadores de tu marca" más abajo. Oculta en
                  mobile: a ese ancho no hay espacio para que sobresalga
                  sin taparle el texto a la tarjeta principal.
                  top-0 -translate-y-1/2 (además del -translate-x-2/3): que
                  quede montada sobre la esquina, mitad afuera / mitad
                  adentro — con solo el desplazamiento horizontal, ese
                  "mitad adentro" caía justo sobre el título "Resultado de
                  la campaña" y lo tapaba. Subiéndola también la mitad de
                  su propio alto, el solape queda arriba del título, no
                  encima. */}
              <div className="hidden sm:flex absolute top-0 left-0 -translate-x-2/3 -translate-y-1/2 z-10 rounded-xl bg-brand-surface border border-brand-line shadow-lg px-3 py-2.5 items-center gap-2.5">
                <div className="flex -space-x-2">
                  {["VR", "CM", "ST"].map((initials) => (
                    <div
                      key={initials}
                      className="w-7 h-7 rounded-full bg-brand-accent-soft text-brand-accent font-display text-[10px] font-semibold flex items-center justify-center ring-2 ring-brand-surface"
                    >
                      {initials}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-brand-ink leading-tight">3 creadores</p>
                  <p className="text-[11px] text-brand-accent font-medium leading-tight">recomendando tu marca</p>
                </div>
              </div>

              {/* Satélite 2 — "el efecto en las ventas de tu e-commerce":
                  un mini-gráfico de barras ascendente, dibujado con divs
                  (sin librería de charts, es solo decorativo). También
                  oculta en mobile — se veía encima del texto de la
                  tarjeta principal, sin espacio para sobresalir limpio.
                  Mismo fix que la satélite 1: translate-x-2/3 +
                  translate-y-1/2 en vez de "-right-2"/"bottom-2", para
                  que quede montada en la esquina (mitad afuera) en vez de
                  tapar "Comisión total generada". */}
              <div className="hidden sm:block absolute bottom-0 right-0 translate-x-2/3 translate-y-1/2 z-10 rounded-xl bg-brand-surface border border-brand-line shadow-lg px-3.5 py-3">
                <p className="text-[11px] text-brand-ink-soft mb-1.5">Ventas del mes</p>
                <div className="flex items-end gap-1 h-8 mb-1">
                  {[5, 7, 6, 9, 8, 11, 14].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full bg-brand-accent"
                      style={{ height: `${h * 2.4}px`, opacity: 0.4 + (i / 6) * 0.6 }}
                    />
                  ))}
                </div>
                <p className="text-xs font-semibold text-brand-accent">↑ 34% este mes</p>
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* Así funciona en tu panel — va justo después del hero, antes de
            plantear el problema, porque es la primera prueba concreta de la
            solución (no solo texto abstracto) — adaptado de páginas como
            UpPromote (códigos por creador, motivar creadores con campañas,
            medir resultados), pero con el look real del portal de Marcolini
            y solo capacidades que ya existen hoy. */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-4 max-w-2xl mx-auto text-balance">
            ¿Quién asume el riesgo de tu marketing?
          </h2>
          <p className="text-brand-ink-soft text-center max-w-lg mx-auto mb-12">
            Con marketing tradicional pagas antes de saber si funciona. Con Marcolini, solo pagas
            cuando ya vendiste.
          </p>

          {/* Comparación de riesgo: la misma idea del hero (pago por
              resultados) pero mostrada, no explicada — dos tarjetas una al
              lado de la otra en vez de un párrafo más. */}
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto mb-20">
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-brand-line mb-4">
                <span className="w-6 h-6 rounded-full border border-brand-line text-brand-ink-soft flex items-center justify-center text-xs shrink-0">
                  ✕
                </span>
                <span className="font-medium text-brand-ink-soft">Marketing tradicional</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Pagas por una publicación</span>
                  <span className="font-mono text-sm font-semibold text-brand-ink">$800.000</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Ventas generadas</span>
                  <span className="font-mono text-sm font-semibold text-brand-ink">?</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Riesgo</span>
                  <span className="text-sm font-semibold text-brand-ink">Todo tuyo</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-accent bg-brand-accent-soft p-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-brand-accent/25 mb-4">
                <span className="w-6 h-6 rounded-full bg-brand-accent text-white flex items-center justify-center shrink-0">
                  <IconCheck className="w-3.5 h-3.5" />
                </span>
                <span className="font-display font-semibold text-brand-accent">Con Marcolini</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Publicación</span>
                  <span className="font-mono text-sm font-semibold text-brand-ink">$0</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Comisión</span>
                  <span className="text-sm font-semibold text-brand-ink">Solo si vende</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Riesgo</span>
                  <span className="text-sm font-semibold text-brand-ink">Basado en resultados</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-20">
            {/* Orden pensado como historia: primero el activo (la red de
                creadores y cómo se les atribuye cada venta), después cómo
                se los motiva y se mide el resultado, y al final —ya
                convencidos— el paso técnico de conectar la tienda. */}

            {/* 1 — red de creadores especializados */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Ya activos en el marketplace de Marcolini</p>
                <div className="grid grid-cols-2 gap-3">
                  {previewRedCreadores.map((c) => (
                    <div key={c.name} className="rounded-xl bg-brand-bg px-3 py-3 text-center">
                      <div className="w-10 h-10 rounded-full bg-brand-accent-soft text-brand-accent font-display text-xs font-semibold flex items-center justify-center mx-auto mb-2">
                        {c.name.split(" ").map((w) => w[0]).join("")}
                      </div>
                      <p className="text-xs font-medium text-brand-ink truncate">{c.name}</p>
                      <p className="text-[11px] text-brand-ink-soft mt-0.5">{c.especialidad}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Accede a una red de creadores lista para vender tu marca
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Docenas de creadores de contenido especializados, con audiencias interesadas en
                  tu categoría, eligen promocionar tu marca a cambio de una comisión. Tú descubres
                  quién realmente genera ventas y escalas las alianzas que mejor funcionan.
                </p>
              </div>
            </div>

            {/* 2 — código de descuento único por creador */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Creadores de tu marca</p>
                <div className="space-y-3">
                  {previewCreadores.map((c) => (
                    <div key={c.code} className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand-accent-soft text-brand-accent font-display text-xs font-semibold flex items-center justify-center shrink-0">
                          {c.name.split(" ").map((w) => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-brand-ink truncate">{c.name}</p>
                          <p className="text-xs text-brand-ink-soft">{c.ventas}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-medium text-brand-accent bg-brand-accent-soft rounded-lg px-2.5 py-1 shrink-0">
                        {c.code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Cada creador recibe su propio código y enlace de ventas
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Marcolini genera automáticamente un código de descuento y un enlace único para
                  cada creador. Cada pedido queda atribuido en tiempo real, para que sepas quién
                  vendió, cuánto facturó y qué comisión le corresponde, sin hojas de cálculo ni
                  seguimiento manual.
                </p>
              </div>
            </div>

            {/* 3 — motivar creadores con campañas */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-medium text-brand-accent tracking-widest bg-brand-accent-soft rounded-full px-3 py-1">
                    MISIÓN
                  </span>
                  <span className="text-xs text-brand-accent font-medium">Activa</span>
                </div>
                <p className="font-display font-semibold text-brand-ink mb-1">Meta de agosto</p>
                <p className="text-xs text-brand-ink-soft mb-4">Meta $2.000.000 · Bono $150.000</p>
                <div className="h-2 rounded-full bg-brand-bg overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-brand-accent" style={{ width: "68%" }} />
                </div>
                <div className="flex items-center justify-between text-xs text-brand-ink-soft mb-5">
                  <span>$1.360.000 vendidos</span>
                  <span>68%</span>
                </div>
                <div className="space-y-2">
                  {previewParticipantes.map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <span className="text-brand-ink">{r.name}</span>
                      <span className={r.ok ? "text-brand-accent font-medium" : "text-brand-ink-soft"}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Lanza Misiones y Flash Campaigns que impulsan más ventas
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Crea retos con metas, bonos y comisiones temporales para incentivar a tus
                  creadores. Marcolini mide el progreso en tiempo real, identifica quién cumplió el
                  objetivo y calcula automáticamente los bonos y comisiones de cada campaña.
                </p>
              </div>
            </div>

            {/* 4 — medir el ROI */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-3">Resultado de la campaña</p>
                <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="font-display text-2xl font-bold text-brand-accent">3.8x</p>
                    <p className="text-xs text-brand-ink-soft">por cada $1 invertido, generaste 3.8x en ventas</p>
                  </div>
                  <p className="text-sm text-brand-ink font-medium mt-1.5">
                    Esta campaña rindió bien — vale la pena repetirla.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">$4.200.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Ventas generadas</p>
                  </div>
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">54</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Órdenes</p>
                  </div>
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">$200.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Bono total otorgado</p>
                  </div>
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">$900.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Comisión total generada</p>
                  </div>
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Descubre qué creadores realmente hacen crecer tu negocio
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Marcolini calcula automáticamente el GMV, las órdenes, las comisiones y el ROI de
                  cada campaña. Identifica qué alianzas generan ganancias reales y toma decisiones
                  basadas en ventas, no en likes o engagement.
                </p>
              </div>
            </div>

            {/* 5 — trazabilidad total / reporte de transacciones */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Transacciones</p>
                <div className="space-y-2">
                  {previewTransacciones.map((t) => (
                    <div key={t.creador} className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-ink truncate">{t.creador}</p>
                        <p className="text-xs font-mono text-brand-ink-soft">{t.fecha} · {t.venta}</p>
                      </div>
                      <span className="text-xs text-brand-ink-soft shrink-0">{t.estado}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Control total de ventas, comisiones y pagos
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Cada pedido queda registrado automáticamente con su creador, monto, comisión y
                  estado de pago. Revisa el historial completo de transacciones y paga a tus
                  creadores con total transparencia, sin conciliaciones manuales.
                </p>
              </div>
            </div>

            {/* 6 — integración con Shopify/WooCommerce (al final: el paso
                técnico de conectar la tienda, ya con la marca convencida) */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Conecta tu tienda</p>
                <div className="space-y-3">
                  {previewIntegraciones.map((p) => (
                    <div key={p.nombre} className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center shrink-0">
                          <IconStore className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-brand-ink">{p.nombre}</span>
                      </div>
                      {p.conectada ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent shrink-0">
                          <IconCheck className="w-4 h-4" /> Conectada
                        </span>
                      ) : (
                        <span className="text-xs text-brand-ink-soft shrink-0">Disponible</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Conecta Shopify o WooCommerce en menos de 5 minutos
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Sin código ni configuraciones complejas. Empieza a vender con creadores de
                  contenido y atribuye automáticamente cada pedido al embajador que lo generó.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tarifa transparente */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
            />
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
              Empieza gratis. Solo pagas cuando vendes.
            </h2>
            <p className="relative text-white/70 max-w-xl mx-auto mb-9 text-balance">
              Tú defines la comisión de tus creadores y el descuento que recibirán tus compradores.
              Marcolini cobra únicamente un 5% sobre las ventas confirmadas, sin mensualidades ni
              costos de instalación. El creador recibe el 100% de la comisión que tú le asignaste.
            </p>
            <Link
              href="/registro/marca"
              className="relative inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
            >
              Crear mi programa gratis
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
