import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconArrowRight, IconCheck } from "@/components/marketing/icons";

// Datos de ejemplo para las vistas previas — mismo tratamiento que la
// versión para marcas: colores, tipos y tiles ya reales en el portal de
// creador (marketplace, códigos, vitrina pública, retos, transacciones),
// solo con cifras de muestra. Nombres de marca inventados-pero-plausibles
// (mismo estilo que "Latin Nails"/"Mixcoco", las marcas demo reales del
// seed) — nunca marcas externas reales con las que Marcolini no tiene
// ninguna relación.
const previewOfertas = [
  { marca: "Latin Nails", descuento: 15, comision: 12 },
  { marca: "Mixcoco", descuento: 10, comision: 15 },
  { marca: "Bella Uñas", descuento: 20, comision: 10 },
];

const previewCodigos = [
  { marca: "Latin Nails", code: "VALE15" },
  { marca: "Mixcoco", code: "VALE10" },
];

const previewVitrinaMarcas = [
  { marca: "Latin Nails", descuento: 15 },
  { marca: "Mixcoco", descuento: 10 },
];

const previewTransacciones = [
  { marca: "Latin Nails", fecha: "12 ago", venta: "$95.000", comision: "$14.250", estado: "Pagada" },
  { marca: "Mixcoco", fecha: "10 ago", venta: "$120.000", comision: "$18.000", estado: "Pagada" },
  { marca: "Bella Uñas", fecha: "8 ago", venta: "$60.000", comision: "$6.000", estado: "Aprobada" },
];

// Respuestas basadas en la lógica real de la plataforma (mismo
// PlatformConfig que en para-marcas: payoutDayOfMonth=15,
// refundHoldDays=15) y en el flujo real del portal de creador — sin
// mínimo de seguidores en ningún lado del código, marketplace con modo
// de vinculación automática o con aprobación (joinMode).
const faq = [
  {
    pregunta: "¿Cuánto cuesta unirme a Marcolini?",
    respuesta: "Nada. Es 100% gratis — nunca pagas por pertenecer a la red ni por unirte a una marca.",
  },
  {
    pregunta: "¿Cuándo y cómo me pagan?",
    respuesta:
      "Por transferencia bancaria directa a la cuenta que registres, el día 15 de cada mes — solo las comisiones ya aprobadas.",
  },
  {
    pregunta: "¿Necesito un mínimo de seguidores?",
    respuesta: "No. No hay un mínimo de audiencia — cualquier creador de contenido puede unirse.",
  },
  {
    pregunta: "¿Puedo unirme a varias marcas a la vez?",
    respuesta: "Sí, a todas las que quieras. Cada marca te da su propio código y su propia comisión.",
  },
  {
    pregunta: "¿Qué pasa si una marca no acepta mi solicitud?",
    respuesta:
      "Algunas marcas te unen automáticamente y otras revisan cada solicitud. Si una no te acepta, puedes explorar el resto del marketplace.",
  },
  {
    pregunta: "¿Qué pasa si un cliente pide un reembolso?",
    respuesta:
      "Tu comisión queda retenida 15 días antes de liberarse — si hay un reembolso en ese período, se ajusta automáticamente.",
  },
];

export default function ParaCreadoresPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader ctaHref="/registro/creador" ctaLabel="Únete gratis" />

      <main className="flex-1">
        {/* Hero — misma estructura que /para-marcas: 2 columnas (texto +
            visual), badge arriba del H1, subhead en rosado, composición
            de tarjeta principal + 2 satélites a la derecha. El visual de
            la derecha es el
            resumen real del dashboard de creador (Comisión confirmada /
            Próximo pago / Pagado este año — mismos 3 tiles y mismas
            etiquetas que /creador, ver creator-finance-service.ts), no
            una ilustración inventada. */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-20 h-[420px] w-[560px] rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
          />
          <div className="relative max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="flex justify-start mb-6">
                <span className="inline-flex items-center bg-brand-surface border border-brand-line rounded-full px-5 py-2.5 font-mono text-xs font-medium text-brand-accent tracking-widest">
                  PARA CREADORAS
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-semibold text-brand-ink mb-5 text-balance leading-[1.15]">
                Convierte tu contenido e influencia en una fuente de ingresos
              </h1>
              <p className="text-brand-accent text-lg sm:text-xl font-semibold mb-8 text-balance max-w-lg">
                Comparte tu código, tus seguidores obtienen descuento y tú ganas una comisión por
                cada compra.
              </p>
              <Link
                href="/registro/creador"
                className="group inline-flex items-center justify-center gap-2 bg-brand-accent text-white rounded-full px-10 py-5 text-base font-medium hover:opacity-90 transition shadow-[0_10px_30px_-10px_var(--brand-accent)]"
              >
                Únete gratis
                <IconArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="py-8 px-6">
              <div className="relative max-w-sm mx-auto">
                <div className="rounded-2xl bg-brand-surface border border-brand-line p-5 sm:p-6 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.2)]">
                  <p className="text-xs text-brand-ink-soft mb-2.5">Tu resumen</p>
                  <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-2.5">
                    <p className="text-xs text-brand-ink-soft mb-0.5">Comisión confirmada</p>
                    <p className="font-display text-2xl font-bold text-brand-accent">$340.000</p>
                    <p className="text-xs text-brand-ink font-medium mt-0.5">lista para tu próximo pago</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-brand-bg px-3 py-2">
                      <p className="font-mono text-base font-medium text-brand-ink leading-tight">15 sep</p>
                      <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Próximo pago</p>
                    </div>
                    <div className="rounded-lg bg-brand-bg px-3 py-2">
                      <p className="font-mono text-base font-medium text-brand-ink leading-tight">$1.820.000</p>
                      <p className="text-xs text-brand-ink-soft leading-snug mt-0.5">Pagado este año</p>
                    </div>
                  </div>
                </div>

                {/* Satélite 1 — "estás unida a varias marcas". Mismo chip de
                    iniciales que ya se ve en /para-marcas y en el resto del
                    portal. Oculta en mobile por la misma razón que en
                    /para-marcas: sin espacio para sobresalir sin tapar la
                    tarjeta principal. */}
                <div className="hidden sm:flex absolute top-0 left-0 -translate-x-2/3 -translate-y-1/2 z-10 rounded-xl bg-brand-surface border border-brand-line shadow-lg px-3 py-2.5 items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {["LN", "MX", "BU"].map((initials) => (
                      <div
                        key={initials}
                        className="w-7 h-7 rounded-full bg-brand-accent-soft text-brand-accent font-display text-[10px] font-semibold flex items-center justify-center ring-2 ring-brand-surface"
                      >
                        {initials}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-brand-ink leading-tight">3 marcas</p>
                    <p className="text-[11px] text-brand-accent font-medium leading-tight">generando comisión</p>
                  </div>
                </div>

                {/* Satélite 2 — mismo mini-gráfico de barras que en
                    /para-marcas, esta vez sobre las ventas propias del
                    creador. */}
                <div className="hidden sm:block absolute bottom-0 right-0 translate-x-2/3 translate-y-1/2 z-10 rounded-xl bg-brand-surface border border-brand-line shadow-lg px-3.5 py-3">
                  <p className="text-[11px] text-brand-ink-soft mb-1.5">Ventas del mes</p>
                  <div className="flex items-end gap-1 h-8 mb-1">
                    {[4, 6, 5, 8, 9, 11, 13].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-brand-accent"
                        style={{ height: `${h * 2.4}px`, opacity: 0.4 + (i / 6) * 0.6 }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-brand-accent">↑ 28% este mes</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Así funciona en tu panel — misma sección que /para-marcas,
            adaptada al lado creador. Orden pensado como historia: primero
            el activo real (el marketplace de marcas), cómo se comparte
            (código + vitrina), cómo se gana más (campañas), y el control
            de pagos. */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <p className="font-display text-xl sm:text-2xl font-bold text-brand-ink text-center max-w-2xl mx-auto mb-12 text-balance">
            Ya recomiendas marcas todos los días.
            <br />
            Con Marcolini, esas recomendaciones te pagan.
          </p>

          {/* Comparación de riesgo, espejo de la de /para-marcas ("Un Reel
              cuesta lo mismo, venda o no."): sin Marcolini, recomendar un
              producto no te paga nada aunque tu comunidad compre — no hay
              forma de que esa venta te llegue de vuelta. Con Marcolini, esa
              misma recomendación se convierte en comisión cobrada sola. */}
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto mb-20">
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-brand-line mb-4">
                <span className="w-6 h-6 rounded-full border border-brand-line text-brand-ink-soft flex items-center justify-center text-xs shrink-0">
                  ✕
                </span>
                <span className="font-medium text-brand-ink-soft">Sin Marcolini</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Recomiendas un producto</span>
                  <span className="font-mono text-sm font-semibold text-brand-ink">$0</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Tu comunidad compra</span>
                  <span className="font-mono text-sm font-semibold text-brand-ink">$0</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Seguimiento</span>
                  <span className="text-sm font-semibold text-brand-ink">Ninguno</span>
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
                  <span className="text-sm text-brand-ink-soft">Recomiendas un producto</span>
                  <IconCheck className="w-4 h-4 text-brand-ink shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Generas una venta</span>
                  <span className="text-sm font-semibold text-brand-ink">Comisión</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-ink-soft">Cobro</span>
                  <span className="text-sm font-semibold text-brand-ink">Automático</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-20">
            {/* 1 — marketplace de marcas. Cada tile lleva su etiqueta
                completa debajo ("Descuento para tu comunidad" / "Tu
                comisión por venta") en vez de pills abreviadas — mismo
                tratamiento que la tarjeta real de oferta en
                /creador/marketplace (ver OfferCard en
                marketplace/page.tsx), para que no haya dudas de cuál
                número es cuál. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Marketplace de marcas</p>
                <div className="space-y-3">
                  {previewOfertas.map((o) => (
                    <div key={o.marca} className="rounded-xl bg-brand-bg px-4 py-3">
                      <p className="text-sm font-medium text-brand-ink mb-2.5">{o.marca}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-brand-surface px-2.5 py-2">
                          <p className="font-mono text-base font-medium text-brand-ink leading-tight">{o.descuento}%</p>
                          <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
                            Descuento para tu comunidad
                          </p>
                        </div>
                        <div className="rounded-lg bg-brand-accent-soft px-2.5 py-2">
                          <p className="font-mono text-base font-medium text-brand-accent leading-tight">
                            {o.comision}%
                          </p>
                          <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">Tu comisión por venta</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Elige las marcas que quieres recomendar
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Explora el marketplace y mira qué descuento tienen para tu audiencia y qué
                  comisión hay para ti. Únete a las que te interesen — sin mínimo de seguidores ni
                  aprobación garantizada, cada marca decide su propio criterio.
                </p>
              </div>
            </div>

            {/* 2 — código y link únicos */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Mis códigos y links</p>
                <div className="space-y-3">
                  {previewCodigos.map((c) => (
                    <div key={c.marca} className="rounded-xl border border-brand-line px-4 py-3">
                      <p className="text-sm font-medium text-brand-ink mb-1.5">{c.marca}</p>
                      <span className="font-mono text-xs font-medium text-brand-accent bg-brand-accent-soft rounded-lg px-2.5 py-1">
                        {c.code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Cada marca te da tu propio código y enlace
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Compártelo en tu bio, historias o WhatsApp. Cada venta hecha con tu código queda
                  atribuida automáticamente a ti — sin que tengas que hacer seguimiento manual.
                </p>
              </div>
            </div>

            {/* 3 — vitrina pública (link-in-bio con colecciones — feature
                real, ver creator-storefront-step.tsx y /c/[slug]/page.tsx).
                Preview estático inspirado en su look real (avatar + marcas
                + productos), no el componente en vivo — esa página tiene su
                propio sistema de temas standalone. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <div className="max-w-[220px] mx-auto text-center">
                  <div className="w-12 h-12 rounded-full bg-brand-accent-soft text-brand-accent font-display font-semibold flex items-center justify-center mx-auto mb-2">
                    V
                  </div>
                  <p className="text-xs font-mono text-brand-accent mb-3">marcolini.co/c/valentina</p>
                  <div className="space-y-2 mb-3">
                    {previewVitrinaMarcas.map((m) => (
                      <div key={m.marca} className="rounded-lg border border-brand-line px-3 py-2 text-left">
                        <p className="text-xs font-medium text-brand-ink">{m.marca}</p>
                        <p className="text-[11px] text-brand-ink-soft">{m.descuento}% de descuento</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="aspect-square rounded-lg bg-brand-bg" />
                    <div className="aspect-square rounded-lg bg-brand-bg" />
                  </div>
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Un solo link para todas tus recomendaciones
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Tu propia vitrina pública con todas tus marcas y tus productos favoritos
                  organizados en colecciones. Personalízala y ponla en la bio de tu Instagram o
                  TikTok — un solo link para todo lo que recomiendas.
                </p>
              </div>
            </div>

            {/* 4 — campañas y bonos (retos — feature real, ver
                creator-challenges-panel.tsx / retos/page.tsx) */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-medium text-brand-accent tracking-widest bg-brand-accent-soft rounded-full px-3 py-1">
                    RETO
                  </span>
                  <span className="text-xs text-brand-accent font-medium">Activo</span>
                </div>
                <p className="font-display font-semibold text-brand-ink mb-1">Meta de agosto — Latin Nails</p>
                <p className="text-xs text-brand-ink-soft mb-4">Meta $500.000 · Bono $50.000</p>
                <div className="h-2 rounded-full bg-brand-bg overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-brand-accent" style={{ width: "72%" }} />
                </div>
                <div className="flex items-center justify-between text-xs text-brand-ink-soft">
                  <span>$360.000 vendidos</span>
                  <span>72%</span>
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Gana bonos extra en campañas activas
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Las marcas activan retos con metas y bonos temporales. Cumple el objetivo y el
                  bono se calcula y se suma automáticamente a tu comisión — sin nada que reclamar.
                </p>
              </div>
            </div>

            {/* 5 — trazabilidad total: saldo + comisiones recientes, el
                equivalente para creador de la tarjeta de ROI de
                /para-marcas. El % de crecimiento es ilustrativo (mismo
                criterio que el mini-gráfico "Ventas del mes" del hero),
                no un campo que el dashboard real calcule — el resto
                (saldo, comisión por marca, estado) sí son datos reales
                que ya muestra /creador y /creador/transacciones. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-2.5">Tu saldo</p>
                <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-4">
                  <p className="font-display text-2xl font-bold text-brand-ink">$1.248.000</p>
                  <p className="text-sm font-semibold text-brand-accent mt-0.5">↑ 18% este mes</p>
                </div>
                <div className="space-y-2">
                  {previewTransacciones.map((t) => (
                    <div key={t.marca} className="flex items-center justify-between gap-3 rounded-xl bg-brand-bg px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-ink truncate">{t.marca}</p>
                        <p className="text-xs text-brand-ink-soft">Comisión</p>
                      </div>
                      <p className="text-sm font-mono font-medium text-emerald-600 shrink-0">+{t.comision}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Sigue tus ingresos en tiempo real
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Cada venta atribuida a tu código se suma a tu saldo al instante, con su marca,
                  monto y estado de pago — para que sepas exactamente cuánto vas a recibir y
                  cuándo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Preguntas frecuentes — mismo patrón que /para-marcas: lista
            estática, sin acordeón, justo antes del cierre. */}
        <section className="max-w-3xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
            Preguntas frecuentes
          </h2>
          <div className="divide-y divide-brand-line">
            {faq.map((item) => (
              <div key={item.pregunta} className="py-6">
                <p className="font-display font-semibold text-brand-ink mb-2">{item.pregunta}</p>
                <p className="text-brand-ink-soft leading-relaxed">{item.respuesta}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cierre — misma estructura que /para-marcas (tarjeta oscura). */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
            />
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
              Tu contenido ya vale — empieza a cobrarlo.
            </h2>
            <p className="relative text-white/70 max-w-lg mx-auto mb-9 text-balance">
              Crea tu perfil gratis, elige tus marcas y comparte tu código. Sin mínimo de
              seguidores, sin permanencia.
            </p>
            <Link
              href="/registro/creador"
              className="relative inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
            >
              Únete gratis
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
