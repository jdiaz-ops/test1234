import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CostCalculator } from "@/components/portal/cost-calculator";
import {
  IconStore,
  IconArrowRight,
  IconCheck,
} from "@/components/marketing/icons";
import { FaqAccordion } from "@/components/marketing/faq-accordion";

// Metadata propia — mismo motivo que /para-creadores: sin esto hereda
// el título/descripción genérico del layout raíz, que asume belleza
// (hoy el marketplace solo tiene "Uñas" poblado). Acá tampoco se nombra
// categoría, se apoya en el mecanismo (comisión solo si vende, red de
// creadores) ya redactado en el resto de la página.
export const metadata: Metadata = {
  title: "Conecta tu marca con creadores de contenido — Marcolini",
  description:
    "Crece tu marca con una red de creadores que solo cobran comisión cuando venden. Crea tu propia tienda dentro de Marcolini, sin mensualidades.",
};

const confianza = ["Sin mensualidades", "Sin costos de instalación"];

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
// Vista previa de "Mi tienda" — tienda nativa dentro de Marcolini (slug +
// plantilla real, ver storefront-template-form.tsx), ya no una integración
// con Shopify/WooCommerce.
const previewTienda = {
  slug: "marcauno",
  plantilla: "Editorial",
};

// Vista previa de muestras — mismo tratamiento que el resto de tiles
// (bg-brand-bg), datos de ejemplo con la lógica real de sample-service.ts
// (stock por producto, estado de la solicitud del creador).
const previewMuestras = [
  { producto: "Sérum vitamina C", detalle: "12 unidades disponibles" },
  { producto: "Bruma facial hidratante", detalle: "Solicitada por Camila M." },
];

// Vista previa de "Buscador de creadores" — mismo tratamiento visual que
// creator-directory-panel.tsx: nombre, especialidad y botón de invitar.
const previewTalento = [
  { name: "Daniela P.", especialidad: "Skincare" },
  { name: "Andrea L.", especialidad: "Maquillaje" },
];

// Solo 2 (antes 4): esta vista ahora comparte tarjeta con el buscador de
// creadores (ver bloque fusionado "Consigue los creadores que tu marca
// necesita" más abajo), así que va compacta.
const previewRedCreadores = [
  { name: "Valentina R.", especialidad: "Uñas" },
  { name: "Camila M.", especialidad: "Skincare" },
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
  { creador: "Camila M.", fecha: "11 ago", venta: "$95.000", estado: "Pagado" },
  { creador: "Sofía T.", fecha: "10 ago", venta: "$210.000", estado: "Pagado" },
];

// Respuestas basadas en la configuración real de la plataforma
// (PlatformConfig en schema.prisma: chargeDayOfMonth=1, payoutDayOfMonth=15,
// refundHoldDays=15), no inventadas ni genéricas.
const faq = [
  {
    pregunta: "¿Qué pasa si un creador no genera ventas?",
    respuesta:
      "No pagas nada. No hay mensualidad ni comisión si no hay una venta confirmada — el riesgo es de la campaña, no tuyo.",
  },
  {
    pregunta: "¿Cuándo y cómo se pagan las comisiones a los creadores?",
    respuesta:
      "Automático: Marcolini cobra tu tarifa el día 1 de cada mes y paga a tus creadores el día 15, sin que tengas que hacer transferencias una por una.",
  },
  {
    pregunta: "¿Qué pasa si un cliente pide un reembolso?",
    respuesta:
      "La comisión del creador queda retenida 15 días antes de liberarse — si hay un reembolso en ese período, se ajusta automáticamente y no pagas comisión sobre una venta que se devolvió.",
  },
  {
    pregunta: "¿Cómo encuentro creadores para mi marca?",
    respuesta:
      "De dos formas: los creadores descubren tu marca en el marketplace de Marcolini y aplican para promocionarla, o tú mismo los buscas en el directorio de creadores y les envías una invitación directa a tu programa.",
  },
  {
    pregunta: "¿Hay permanencia mínima o contrato?",
    respuesta: "No. Sin mensualidad, sin permanencia — cancelas cuando quieras.",
  },
];

export default function ParaMarcasPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader
        ctaHref="/registro/marca"
        ctaLabel="Crear Cuenta"
        loginLabel="Portal Marca"
        showRoleLinks={false}
      />

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
            {/* Vuelve al alineado original (izquierda) por defecto — el
                centrado es SOLO para la versión web (lg+), vía lg:text-center,
                no en mobile. */}
            <div className="lg:text-center">
              {/* Vuelve al tamaño de dos rondas atrás — el +20% de la ronda
                  anterior lo hizo demasiado grande otra vez. */}
              <h1 className="font-display text-2xl sm:text-4xl font-semibold text-brand-ink mb-5 text-balance leading-[1.15]">
                Crece tu marca conectando con nuestra red de creadores de contenido
              </h1>
              <p className="text-brand-accent text-lg sm:text-xl font-semibold mb-8 text-balance max-w-lg lg:mx-auto">
                Solo pagas comisión cuando generan ventas
              </p>
              <Link
                href="/registro/marca"
                className="group inline-flex items-center justify-center gap-2 bg-brand-accent text-white rounded-full px-10 py-5 text-base font-medium hover:opacity-90 transition shadow-[0_10px_30px_-10px_var(--brand-accent)]"
              >
                Crear Cuenta
                <IconArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {/* "Empieza gratis" y "Sin mensualidades" salieron del subhead
                  y volvieron como checklist de confianza debajo del botón —
                  igual que antes, pero ahora con "Sin costos de
                  instalación" en vez del tercer ítem que había. */}
              <div className="flex flex-wrap items-center justify-start lg:justify-center gap-x-5 gap-y-2 mt-5">
                {confianza.map((texto) => (
                  <span key={texto} className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink">
                    <IconCheck className="w-5 h-5 text-brand-accent shrink-0" />
                    {texto}
                  </span>
                ))}
              </div>
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
          <p className="font-display text-xl sm:text-2xl font-bold text-brand-ink text-center max-w-2xl mx-auto mb-12 text-balance">
            Un Reel cuesta lo mismo, venda o no.
            <br />
            Con Marcolini, solo pagas cuando vende.
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
                  <span className="text-sm text-brand-ink-soft">Pagas por un Reel</span>
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
            {/* Orden pensado como historia: primero el simulador (responde
                "cuánto me cuesta" antes que nada, con la marca metiendo sus
                propios números), después el activo (la red de creadores y
                cómo se les atribuye cada venta), cómo se los motiva y se
                mide el resultado, y al final —ya convencidos— el paso
                técnico de conectar la tienda. */}

            {/* 1 — cómo se reparte una venta: no una tarjeta de precio, sino
                el mismo simulador de costos que ya existe de verdad en el
                portal (Oferta y comisión / onboarding — ver
                cost-calculator.tsx), con números de ejemplo. Es interactivo:
                la marca puede meter su propio ticket de compra y ver el
                reparto real, no una ilustración estática. vatPercent=0
                porque en esta página se comunica una tarifa plana del 5%
                (sin el detalle de IVA que sí se explica ya dentro del
                portal) — el label "+ IVA" del componente es condicional a
                vatPercent > 0, así que desaparece solo. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <CostCalculator commission={8} discount={10} platformFeePercent={5} vatPercent={0} editableRates />
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Solo ganamos cuando tu marca vende
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Empieza gratis, sin mensualidades ni costos de instalación. Tú defines la
                  comisión de tus creadores y el descuento para tus compradores; Marcolini cobra
                  únicamente un 5% sobre cada venta confirmada.
                </p>
              </div>
            </div>

            {/* CTA a mitad de la sección, justo después del simulador — es
                el punto de mayor intención de toda la página (la marca
                acaba de meter SUS propios números), no tiene sentido
                hacerla esperar hasta el final para poder actuar. Copy
                distinto al del hero/cierre a propósito, referenciando lo
                que acaba de hacer en vez de repetir "Empieza gratis". */}
            <div className="flex justify-center -mt-6">
              <Link
                href="/registro/marca"
                className="group inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
              >
                Crea tu programa
                <IconArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* 2 — red de creadores (marketplace pasivo, ver
                previewRedCreadores) + buscador de creadores con invitación
                directa (creator-directory-panel.tsx / marca/creadores/buscar,
                ver previewTalento) fusionados en un solo bloque: son las dos
                caras de "conseguir creadores para tu marca" — antes eran dos
                bloques separados y quedaban repetitivos uno detrás del otro. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-3">Tu red</p>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {previewRedCreadores.map((c) => (
                    <div key={c.name} className="rounded-xl bg-brand-bg px-3 py-2.5 text-center">
                      <div className="w-8 h-8 rounded-full bg-brand-accent-soft text-brand-accent font-display text-[11px] font-semibold flex items-center justify-center mx-auto mb-1.5">
                        {c.name.split(" ").map((w) => w[0]).join("")}
                      </div>
                      <p className="text-xs font-medium text-brand-ink truncate">{c.name}</p>
                      <p className="text-[11px] text-brand-ink-soft mt-0.5">{c.especialidad}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-brand-ink-soft mb-3 pt-4 border-t border-brand-line">Buscar e invitar</p>
                <div className="space-y-2">
                  {previewTalento.map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-accent-soft text-brand-accent font-display text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {c.name.split(" ").map((w) => w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-brand-ink truncate">{c.name}</p>
                          <p className="text-[11px] text-brand-ink-soft">{c.especialidad}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-brand-accent bg-brand-accent-soft rounded-full px-2.5 py-1 shrink-0">
                        Invitar
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Consigue los creadores que tu marca necesita
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Accede a nuestra red: creadores especializados aplican solos para promocionar tu
                  marca. O tú mismo buscas por categoría en el directorio y los invitas directo a tu
                  programa, con la comisión que quieras ofrecer.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Empieza a sumar creadores
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 3 — gestión de muestras/regalos directamente desde la
                plataforma (sample-service.ts): la marca regala producto a
                creadores para que los prueben y los muestren en su
                contenido, sin salir de Marcolini. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Muestras</p>
                <div className="space-y-3">
                  {previewMuestras.map((m) => (
                    <div key={m.producto} className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-ink truncate">{m.producto}</p>
                        <p className="text-xs text-brand-ink-soft">{m.detalle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Gestiona el envío de muestras a tus creadores
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Regala producto a los creadores de tu red para que lo prueben y lo muestren en su
                  contenido — recibe y aprueba solicitudes de muestra directamente desde tu panel,
                  sin coordinar envíos por fuera de la plataforma.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Envía tu primera muestra
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 4 — código de descuento único por creador */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
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
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Cada creador recibe su propio código de descuento y enlace de ventas
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Marcolini genera automáticamente un código de descuento y un enlace único para
                  cada creador. Cada pedido queda atribuido en tiempo real, para que sepas quién
                  vendió y qué comisión le corresponde, sin hojas de cálculo ni seguimiento
                  manual.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Automatiza tus códigos
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 5 — motivar creadores con campañas */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
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
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Lanza Misiones y Campañas Flash Sales que impulsan más ventas
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Crea retos con metas, bonos y comisiones temporales para incentivar a tus
                  creadores. Marcolini mide el progreso en tiempo real, identifica quién cumplió el
                  objetivo y calcula automáticamente los bonos y comisiones de cada campaña.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Lanza tu primera campaña
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 6 — medir el ROI */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
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
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Descubre qué creadores realmente hacen crecer tu negocio
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Marcolini calcula automáticamente las ventas generadas, las órdenes, las
                  comisiones y el ROI de cada campaña.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Mide tu ROI
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 7 — trazabilidad total / reporte de transacciones */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
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
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Control total de ventas, comisiones y pagos
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Cada pedido queda registrado automáticamente con su creador, monto, comisión y
                  estado de pago. Revisa el historial completo de transacciones y paga a tus
                  creadores con total transparencia, sin conciliaciones manuales.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Controla tus pagos
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 8 — Mi tienda: tienda propia dentro de Marcolini (al final:
                el paso técnico de tener tu tienda, ya con la marca
                convencida). Antes era "conecta Shopify/WooCommerce" — hoy
                la marca no depende de un e-commerce externo, publica su
                catálogo directamente en Marcolini. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Tu tienda</p>
                <div className="rounded-xl bg-brand-bg px-4 py-4 mb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center shrink-0">
                      <IconStore className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-sm font-medium text-brand-accent truncate">
                      {previewTienda.slug}.marcolini.lat
                    </span>
                  </div>
                  <p className="text-xs text-brand-ink-soft">Tienda pública, lista para compartir</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-3">
                  <span className="text-sm font-medium text-brand-ink">Plantilla</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent shrink-0">
                    <IconCheck className="w-4 h-4" /> {previewTienda.plantilla}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Crea tu tienda dentro de Marcolini
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Publica tu catálogo en tu propia tienda con subdominio gratis (o tu dominio
                  propio), elige una plantilla y empieza a vender y a atribuir ventas a tus
                  creadores desde el primer día.
                </p>
                <Link
                  href="/registro/marca"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Crea tu tienda
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* Preguntas frecuentes — justo antes del cierre/CTA final, que es
            donde alguien casi convencido todavía tiene dudas puntuales
            antes de dar el clic. Acordeón (FaqAccordion, mismo componente
            que /para-creadores): preguntas cerradas por defecto, se abren
            al hacer clic. Respuestas basadas en la lógica real del
            producto (ver PlatformConfig en schema.prisma:
            chargeDayOfMonth=1, payoutDayOfMonth=15, refundHoldDays=15),
            no inventadas. */}
        <section className="max-w-3xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
            Preguntas frecuentes
          </h2>
          <FaqAccordion items={faq} />
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
              Tu próxima venta puede venir de un creador.
            </h2>
            <p className="relative text-white/70 max-w-lg mx-auto mb-9 text-balance">
              Lanza tu programa hoy. Conecta tu tienda en minutos y empieza a vender pagando solo
              por resultados.
            </p>
            <Link
              href="/registro/marca"
              className="relative inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
            >
              Empieza gratis
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
