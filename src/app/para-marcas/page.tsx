import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  IconTarget,
  IconUsers,
  IconStore,
  IconTrace,
  IconSliders,
  IconTrendingUp,
  IconArrowRight,
  IconHeart,
  IconChart,
  IconWallet,
  IconCheck,
  IconInfo,
} from "@/components/marketing/icons";

// El último ítem lleva `detail` — se explica con la misma lógica de
// "aclaración" al pasar el mouse/tocar que usan páginas como UpPromote para
// su "+1.5% successful referral sales", en vez de meter la letra chica
// directo en el badge de confianza.
const confianza: { texto: string; detail?: string }[] = [
  { texto: "Solo pagas cuando vendes" },
  { texto: "5 minutos de configuración en Shopify o WooCommerce" },
  { texto: "Ventas 100% trazables" },
  {
    texto: "Tus compradores reciben descuento",
    detail:
      "Tú defines el % de descuento que reciben tus compradores con el código de cada creador — Marcolini nunca lo decide por ti.",
  },
];

const problema = [
  {
    icon: IconHeart,
    titulo: "Los likes no son ventas",
    texto: "El engagement no paga las facturas.",
  },
  {
    icon: IconChart,
    titulo: "Mide el ROI",
    texto: "Conoce cuánto vendió cada creador.",
  },
  {
    icon: IconTarget,
    // No "invierte con confianza / destina presupuesto" — Marcolini no le
    // pide presupuesto a la marca por adelantado, así que esa frase no
    // encajaba con el modelo. El ángulo real es que no hay riesgo: se paga
    // solo cuando hay una venta real, nunca antes.
    titulo: "Sin riesgo por adelantado",
    texto: "No pagas nada hasta que haya una venta real.",
  },
];

const beneficios = [
  {
    icon: IconTarget,
    titulo: "Paga solo por resultados",
    // Antes decía solo "5% únicamente sobre las ventas generadas" — se
    // podía leer como que eso es TODO lo que se paga, cuando en realidad
    // son dos componentes: la comisión del creador (la define la marca) +
    // el 5% de Marcolini. Ahora queda explícito que son dos cosas, ambas
    // atadas a que haya una venta real.
    texto: "La comisión del creador que tú defines, más el 5% de Marcolini — ambos solo sobre las ventas generadas por este canal.",
  },
  {
    icon: IconUsers,
    titulo: "Red de creadores especializados",
    texto: "Accede a una comunidad enfocada en uñas y belleza.",
  },
  {
    icon: IconStore,
    titulo: "Conecta tu tienda en minutos",
    texto: "Shopify o WooCommerce, sin desarrollos ni integraciones complejas.",
  },
  {
    icon: IconTrace,
    titulo: "Trazabilidad total",
    texto: "Cada creador tiene su propio código: da descuento a tus compradores (tú defines el %) y te dice quién vendió, cuánto vendió y cuánto pagar.",
  },
  {
    icon: IconSliders,
    titulo: "Comisiones flexibles",
    texto: "Define el porcentaje para cada campaña.",
  },
  {
    icon: IconTrendingUp,
    titulo: "Escala sin aumentar riesgo",
    texto: "Más ventas sin pagar por publicaciones anticipadamente.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Conecta tu tienda",
    texto: "Shopify o WooCommerce en pocos minutos.",
  },
  {
    paso: "2",
    titulo: "Lanza una campaña",
    texto: "Define la comisión y activa a tus creadores.",
  },
  {
    paso: "3",
    titulo: "Los creadores venden",
    texto: "Cada uno comparte su código único, que da descuento a tus compradores — tú sabes exactamente quién generó cada venta.",
  },
  {
    paso: "4",
    titulo: "Mide y paga",
    texto: "Paga únicamente las ventas confirmadas.",
  },
];

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

const cambioMercado = [
  {
    icon: IconWallet,
    titulo: "La publicidad es cada vez más cara",
    texto: "Los costos de adquisición siguen aumentando.",
  },
  {
    icon: IconUsers,
    titulo: "Las personas confían en personas",
    texto: "Los creadores generan recomendaciones más auténticas que los anuncios.",
  },
  {
    icon: IconTrendingUp,
    titulo: "Ahora puedes medirlo",
    texto: "Cada venta queda atribuida al creador que la originó.",
  },
];

// Aclaración al estilo del "+1.5% successful referral sales" de UpPromote:
// una etiqueta con subrayado punteado + ícono de info que revela el detalle
// al pasar el mouse o al tocar. Usa <details>/<summary> nativo (sin JS, sin
// "use client") para que funcione igual con clic/toque en mobile.
function InfoClarification({ label, detail }: { label: string; detail: string }) {
  return (
    <details className="relative inline-block text-left">
      <summary className="inline-flex items-center gap-1.5 cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="border-b border-dotted border-brand-ink-soft">{label}</span>
        <IconInfo className="w-4 h-4 text-brand-ink-soft shrink-0" />
      </summary>
      {/* Se abre hacia arriba, no hacia abajo — el hero donde vive el
          primer uso tiene overflow-hidden (para recortar el blur
          decorativo) y el bloque de confianza es lo último dentro de esa
          sección, así que un popover hacia abajo quedaba cortado por ese
          overflow-hidden. Hacia arriba siempre hay espacio de sobra. */}
      <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 rounded-xl bg-brand-ink text-white text-xs leading-relaxed p-3 shadow-lg">
        {detail}
      </div>
    </details>
  );
}

export default function ParaMarcasPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
          />
          <div className="relative max-w-3xl mx-auto px-6 pt-24 pb-20 text-center">
            <span className="inline-block font-mono text-xs font-medium text-brand-accent tracking-widest bg-brand-accent-soft rounded-full px-4 py-1.5 mb-7">
              MARKETING DE INFLUENCIA SIMPLE Y MEDIBLE
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-semibold text-brand-ink mb-6 text-balance leading-[1.08]">
              Convierte a los creadores de contenido en tu mejor canal de ventas
            </h1>
            <p className="text-brand-ink-soft text-lg sm:text-xl max-w-xl mx-auto mb-10 text-balance">
              Descubre creadores especializados, lanza campañas con comisiones y mide exactamente
              quién genera ventas para tu marca.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-10">
              <Link
                href="/registro/marca"
                className="group inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition shadow-[0_10px_30px_-10px_var(--brand-accent)]"
              >
                Crear mi programa gratis
                <IconArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/login" className="text-sm text-brand-ink-soft hover:text-brand-ink hover:underline">
                Ya tengo cuenta
              </Link>
            </div>
            {/* Grid en vez de flex-wrap: con un número impar de ítems, el
                wrap dejaba uno solo flotando en su propia fila — se veía
                descuadrado. El grid siempre reparte 2x2 (o apilado en
                mobile), sin importar cuántos ítems haya. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3 max-w-lg mx-auto justify-items-center sm:justify-items-start">
              {confianza.map((c) => (
                <span key={c.texto} className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink">
                  <IconCheck className="w-5 h-5 text-brand-accent shrink-0" />
                  {c.detail ? <InfoClarification label={c.texto} detail={c.detail} /> : c.texto}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* El problema */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-4 text-balance">
            Deja de adivinar qué creadores de contenido realmente hacen vender
          </h2>
          <p className="text-brand-ink-soft text-center max-w-2xl mx-auto mb-12 text-balance">
            La mayoría del marketing de influencia termina en likes, vistas y engagement. Marcolini
            rastrea ventas reales para que sepas exactamente qué creadores generan crecimiento para
            tu negocio.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {problema.map((b) => (
              <div key={b.titulo} className="rounded-2xl bg-brand-surface border border-brand-line p-6">
                <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5" />
                </div>
                <p className="font-display font-semibold text-brand-ink mb-1.5">{b.titulo}</p>
                <p className="text-sm text-brand-ink-soft leading-relaxed">{b.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Así funciona en tu panel — se ubica temprano, justo después de
            plantear el problema, porque es la primera prueba concreta de la
            solución (no solo texto abstracto) — adaptado de páginas como
            UpPromote (códigos por creador, motivar creadores con campañas,
            medir resultados), pero con el look real del portal de Marcolini
            y solo capacidades que ya existen hoy. */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
            ASÍ FUNCIONA EN TU PANEL
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-16 max-w-2xl mx-auto text-balance">
            Todo lo que necesitas para vender a través de creadores, en un solo lugar
          </h2>

          <div className="space-y-20">
            {/* 1 — integración con Shopify/WooCommerce */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
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
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Integración en minutos con Shopify o WooCommerce
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Sin desarrollos ni integraciones complejas — en cinco minutos tu tienda queda
                  lista para recibir ventas de tus creadores, con cada orden atribuida
                  automáticamente.
                </p>
              </div>
            </div>

            {/* 2 — red de creadores especializados */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Creadores especializados en tu categoría</p>
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
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Una red de creadores especializados en belleza
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Accede a una comunidad de creadores enfocados en uñas y belleza — perfiles afines
                  a tu marca, no una audiencia genérica.
                </p>
              </div>
            </div>

            {/* 3 — código de descuento único por creador */}
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
                  Un código de descuento único para cada creador
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Apenas un creador se une a tu marca, genera automáticamente su propio código de
                  descuento — tú defines el % que reciben tus compradores. Cada venta hecha con ese
                  código queda atribuida al creador: sabes exactamente quién vendió, cuánto vendió y
                  cuánto le debes pagar, sin hacer seguimiento a mano.
                </p>
              </div>
            </div>

            {/* 4 — motivar creadores con campañas */}
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
                  Motiva a tus creadores con campañas por tiempo limitado
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Lanza una Misión con meta y bono, un Flash Sale que sube la comisión por unos días,
                  o un Mix de ambos. Tú defines las reglas; Marcolini calcula quién llegó a la meta y
                  paga el bono automáticamente.
                </p>
              </div>
            </div>

            {/* 5 — medir el ROI */}
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
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Ventas generadas (GMV)</p>
                  </div>
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">54</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Órdenes</p>
                  </div>
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">$150.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Bono total otorgado</p>
                  </div>
                  <div className="rounded-xl bg-brand-bg px-3 py-2.5">
                    <p className="font-mono text-lg font-medium text-brand-ink leading-tight">$630.000</p>
                    <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Comisión total generada</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Mide el retorno real de cada campaña
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Ventas generadas, órdenes, comisiones pagadas y cuántas veces recuperaste lo
                  invertido — calculado automáticamente al terminar cada campaña, sin hojas de cálculo
                  ni reportes manuales.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Beneficios */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
            ¿POR QUÉ MARCOLINI?
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
            Un canal de ventas que se paga solo con resultados
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {beneficios.map((b) => (
              <div
                key={b.titulo}
                className="group rounded-2xl bg-brand-surface border border-brand-line p-6 hover:border-brand-accent hover:shadow-[0_16px_40px_-24px_var(--brand-accent)] transition"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-4 group-hover:scale-105 transition">
                  <b.icon className="w-5 h-5" />
                </div>
                <p className="font-display font-semibold text-brand-ink mb-1.5">{b.titulo}</p>
                <p className="text-sm text-brand-ink-soft leading-relaxed">{b.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-14">
            ¿Cómo funciona?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 relative">
            <div
              aria-hidden
              className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-brand-line"
            />
            {pasos.map((p) => (
              <div key={p.paso} className="relative text-center">
                <div className="relative z-10 w-12 h-12 mx-auto rounded-full bg-brand-accent text-white font-mono text-sm font-semibold flex items-center justify-center mb-5">
                  {p.paso}
                </div>
                <p className="font-display font-semibold text-brand-ink mb-2">{p.titulo}</p>
                <p className="text-sm text-brand-ink-soft leading-relaxed max-w-[200px] mx-auto">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* El cambio del mercado — banda con tinte, para marcar el cambio de
            ritmo antes de la tarifa (mismo tono que ya se usa en los avisos
            del portal, no un color nuevo). Sin cifras globales todavía — la
            plataforma es nueva y una promesa atemporal es más honesta que un
            número inflado. */}
        <section className="bg-brand-accent-soft/40 border-t border-brand-line">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
              EL CAMBIO DEL MERCADO
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 max-w-2xl mx-auto text-balance">
              El futuro del marketing no es pagar por publicaciones. Es pagar por resultados.
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {cambioMercado.map((b) => (
                <div key={b.titulo} className="rounded-2xl bg-brand-surface border border-brand-line p-6">
                  <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-4">
                    <b.icon className="w-5 h-5" />
                  </div>
                  <p className="font-display font-semibold text-brand-ink mb-1.5">{b.titulo}</p>
                  <p className="text-sm text-brand-ink-soft leading-relaxed">{b.texto}</p>
                </div>
              ))}
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
            <p className="relative font-mono text-2xl font-semibold text-brand-accent mb-3 tracking-wide">5%</p>
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
              Una sola tarifa. Sin mensualidades.
            </h2>
            <p className="relative text-white/70 max-w-xl mx-auto mb-9 text-balance">
              Tú defines la comisión del creador y el descuento para el comprador final. Marcolini
              solo cobra un 5% sobre las ventas generadas. Nunca descontamos dinero de lo que gana
              el creador.
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
