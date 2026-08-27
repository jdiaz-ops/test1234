import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BrandMiniProfile } from "@/components/portal/brand-mini-profile";
import { IconArrowRight, IconCheck, IconPhoto, IconProduct } from "@/components/marketing/icons";
import { FaqAccordion } from "@/components/marketing/faq-accordion";

// Metadata propia — sin esto la página hereda el título/descripción
// genérico del layout raíz ("Marcolini" / "Red de afiliación para la
// industria de belleza"), que además asume belleza: hoy el marketplace
// solo tiene poblado el vertical "Uñas" (ver Vertical en schema.prisma),
// con belleza y moda como categorías futuras — por eso el copy de acá
// no nombra ninguna categoría, se apoya en el mecanismo (código propio,
// comisión por venta) que ya está redactado en el resto de la página.
export const metadata: Metadata = {
  title: "Gana comisión recomendando marcas con tu propio código — Marcolini",
  description:
    "Únete gratis, elige las marcas que quieres recomendar y comparte tu código de descuento. Gana una comisión por cada venta, sin mínimo de seguidores.",
};

// Checklist de confianza debajo del CTA del hero — mismo patrón que
// /para-marcas (ver `confianza` ahí): datos reales de la plataforma, no
// mínimo de seguidores en ningún lado del código, pago el día 15 de cada
// mes (payoutDayOfMonth=15 en PlatformConfig).
const confianza = ["Sin mínimo de seguidores", "Pago mensual de comisiones"];

// Datos de ejemplo para las vistas previas — mismo tratamiento que la
// versión para marcas: colores, tipos y tiles ya reales en el portal de
// creador (marketplace, códigos, vitrina pública, retos, transacciones).
// Marcas 100% inventadas (Aurora Beauty / Bruma Cosmética)
// — no son marcas reales ni tampoco las demo del seed ("Latin Nails",
// "Mixcoco") — hasta que existan marcas de verdad en la plataforma. Sin
// logoUrl a propósito: BrandMiniProfile (el mismo componente que ya usan
// marcas y creadores) cae solo en su estado real de "sin logo todavía"
// (círculo con iniciales) — no es una ilustración inventada, es
// literalmente cómo se ve hoy una marca sin logo subido.
const previewOfertas = [
  { marca: "Aurora Beauty", categoria: "Skincare", web: "aurorabeauty.co", descuento: 10, comision: 6 },
  { marca: "Bruma Cosmética", categoria: "Maquillaje", web: "brumacosmetica.co", descuento: 10, comision: 7.5 },
];

const previewCodigos = [{ marca: "Aurora Beauty", code: "VALE10", link: "aurorabeauty.co/VALE10", descuento: 10, comision: 6 }];

const previewVitrinaMarcas = [
  { marca: "Aurora Beauty", descuento: 10, code: "VALE10" },
  { marca: "Bruma Cosmética", descuento: 10, code: "VALE10" },
];

const previewColeccion = {
  nombre: "Mi rutina de skincare",
  descripcion: "Lo que uso todos los días",
  productos: [
    { marca: "Aurora Beauty", nombre: "Sérum vitamina C", precio: "$65.000" },
    { marca: "Bruma Cosmética", nombre: "Bruma facial hidratante", precio: "$42.000" },
  ],
};

const previewTransacciones = [
  { marca: "Aurora Beauty", fecha: "12 ago", venta: "$95.000", comision: "$5.700", estado: "Pagada" },
  { marca: "Bruma Cosmética", fecha: "10 ago", venta: "$120.000", comision: "$9.000", estado: "Pagada" },
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
      <SiteHeader
        ctaHref="/registro/creador"
        ctaLabel="Únete gratis"
        mobileCtaLabel="Crear mi perfil"
        loginLabel="Portal Creadores"
      />

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
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start mb-6">
                <span className="inline-flex items-center bg-brand-surface border border-brand-line rounded-full px-5 py-2.5 font-mono text-xs font-medium text-brand-accent tracking-widest">
                  PARA CREADORES
                </span>
              </div>
              {/* En mobile el título ahora va más grande (text-3xl, antes
                  text-2xl) y el subtítulo más chico (text-base, antes
                  text-lg) para que la jerarquía título > subtítulo se note
                  — antes quedaban casi al mismo tamaño visual. */}
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand-ink mb-5 text-balance leading-[1.15]">
                Convierte tu contenido e influencia en dinero
              </h1>
              <p className="text-brand-accent text-base sm:text-xl font-semibold mb-8 text-balance max-w-lg mx-auto lg:mx-0">
                Obtén códigos de descuento para tu comunidad y gana una comisión por cada compra
                que realicen con ellos.
              </p>
              <Link
                href="/registro/creador"
                className="group inline-flex items-center justify-center gap-2 bg-brand-accent text-white rounded-full px-10 py-5 text-base font-medium hover:opacity-90 transition shadow-[0_10px_30px_-10px_var(--brand-accent)]"
              >
                Crear mi perfil gratis
                <IconArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {/* Checklist de confianza — mismo patrón que /para-marcas. */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 mt-5">
                {confianza.map((texto) => (
                  <span key={texto} className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink">
                    <IconCheck className="w-5 h-5 text-brand-accent shrink-0" />
                    {texto}
                  </span>
                ))}
              </div>
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

                {/* Satélite 1 — mismo chip de iniciales que ya se ve en
                    /para-marcas (ahí: "3 creadores recomendando tu
                    marca") y en el resto del portal. Iniciales propias
                    (no "AB"/"BC", que ya son Aurora Beauty/Bruma
                    Cosmética más abajo en esta misma página) para no
                    confundir avatares de creadoras con iniciales de
                    marca. Oculta en mobile por la misma razón que en
                    /para-marcas: sin espacio para sobresalir sin tapar la
                    tarjeta principal. */}
                <div className="hidden sm:flex absolute top-0 left-0 -translate-x-2/3 -translate-y-1/2 z-10 rounded-xl bg-brand-surface border border-brand-line shadow-lg px-3 py-2.5 items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {["MG", "SL", "CR"].map((initials) => (
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
            Ya recomiendas marcas todos los días. Con Marcolini, conviertes esas recomendaciones en
            ingresos.
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
            {/* 1 — marketplace de marcas. Reutiliza BrandMiniProfile tal
                cual — el mismo componente que ya se usa en el marketplace
                real (ver OfferCard en marketplace/page.tsx) — en vez de
                un nombre suelto: logo (o su fallback real de iniciales),
                nombre, categoría y sitio web. Debajo, los mismos 2 tiles
                con etiqueta completa que ya usa esa tarjeta real
                ("Descuento para tu comunidad" / "Tu comisión por venta"),
                para que no haya dudas de cuál número es cuál, y el mismo
                botón de unirse (idle state de JoinOfferButton: "Unirme a
                este programa") — acá es solo visual, sin acción real
                detrás. Dos marcas en vez de tres para que la ilustración
                no quede tan larga. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="lg:order-2 rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Marketplace de marcas</p>
                <div className="space-y-3">
                  {previewOfertas.map((o) => (
                    <div key={o.marca} className="rounded-xl bg-brand-bg px-4 py-3">
                      <BrandMiniProfile companyName={o.marca} description={o.categoria} websiteUrl={`https://${o.web}`} />
                      <div className="grid grid-cols-2 gap-2 mt-3">
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
                      <p className="w-full text-center bg-brand-accent text-white rounded-full px-4 py-2 text-sm font-medium mt-3">
                        Unirme a este programa
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Elige las marcas con las que quieres ganar dinero
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Explora el marketplace y descubre qué ofrece cada marca: el descuento que recibirá
                  tu comunidad y la comisión que ganarás por cada venta. Únete a tantas marcas como
                  quieras y empieza a compartir sus códigos y enlaces desde un solo lugar.
                </p>
                <Link
                  href="/registro/creador"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Explorar marcas
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 2 — código y link únicos. Antes era un nombre + una pill de
                código — "muy pobre" para explicar el mecanismo. Ahora
                mirror exacto de la tarjeta real de /creador/codigos:
                código + link juntos (son las dos piezas de compartir) y
                los mismos 2 tiles de descuento/comisión. Una sola marca
                (Aurora Beauty) para que la ilustración no quede tan
                larga — el mecanismo es el mismo sin importar cuántas
                marcas tenga la creadora. */}
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-7">
                <p className="text-xs text-brand-ink-soft mb-4">Mis códigos y links</p>
                <div className="space-y-4">
                  {previewCodigos.map((c) => (
                    <div key={c.marca} className="rounded-xl border border-brand-line px-4 py-4">
                      <p className="font-display font-semibold text-brand-ink mb-3">{c.marca}</p>
                      <div className="rounded-lg border border-brand-line px-3 py-2.5 mb-3 divide-y divide-brand-line">
                        <div className="pb-2">
                          <span className="font-mono text-brand-accent font-medium">{c.code}</span>
                          <p className="text-xs text-brand-ink-soft mt-0.5">Tu código para compartir</p>
                        </div>
                        <div className="pt-2">
                          <span className="text-xs font-mono text-brand-ink block truncate">{c.link}</span>
                          <p className="text-xs text-brand-ink-soft mt-0.5">Link de la tienda para compartir</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-brand-bg px-3 py-2">
                          <p className="font-mono text-base font-medium text-brand-ink leading-tight">
                            {c.descuento}%
                          </p>
                          <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
                            Código de descuento para tu comunidad
                          </p>
                        </div>
                        <div className="rounded-lg bg-brand-accent-soft px-3 py-2">
                          <p className="font-mono text-base font-medium text-brand-accent leading-tight">
                            {c.comision}%
                          </p>
                          <p className="text-[11px] text-brand-ink-soft leading-snug mt-0.5">
                            Tu comisión por cada venta
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink mb-3">
                  Recibe un código y un enlace único para cada marca
                </h3>
                <p className="text-brand-ink-soft leading-relaxed mb-6">
                  Cada vez que te unes a una marca obtienes tu propio código de descuento y un
                  enlace personalizado. Compártelos en Instagram, TikTok, WhatsApp o donde quieras:
                  las ventas quedan atribuidas automáticamente a tu perfil y tu comisión se registra
                  sin tener que reclamar ni hacer seguimiento manual.
                </p>
                <Link
                  href="/registro/creador"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Quiero mis códigos
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* 3 — vitrina pública: la pieza central de toda la
                estrategia — un solo lugar donde viven el link, los
                códigos activos y las colecciones, así que va como un
                único mockup grande (rompe el patrón de 2 columnas del
                resto de bloques, mismo recurso que el simulador de
                para-marcas). Fiel al look real de /c/[slug]/page.tsx:
                avatar, link con el slug, frase (storefrontHeadline),
                tarjetas de marca con la misma frase exacta ("Obtén X% de
                descuento con esta marca usando mi código Y" + "Ir a la
                tienda →"), y las mismas tarjetas de producto de las
                colecciones (imagen, marca, nombre, precio, "Ver en
                tienda →") — nada inventado. Las etiquetas de "códigos
                activos" y "colecciones" salen del mockup como notas
                flotantes a los lados (izquierda/derecha), centradas a
                la altura de su zona y conectadas con una línea al
                borde del mockup — en vez de vivir adentro como parte
                de la interfaz. En mobile, sin espacio para flotar, la
                misma nota baja al flujo normal justo encima de su
                zona. */}
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-brand-ink text-center mb-3">
                Un solo link para todo lo que recomiendas
              </h3>
              <p className="text-brand-ink-soft text-center max-w-lg mx-auto mb-6">
                Crea tu propia vitrina pública con tus marcas, códigos de descuento y colecciones de
                productos favoritos en una sola página. Personalízala y ponla en la bio de
                Instagram, TikTok o cualquier red para que tu comunidad encuentre todo lo que
                recomiendas desde un único enlace.
              </p>
              {/* "TU LINK" + el link en sí viven acá, arriba del CTA — es
                  la promesa central del bloque ("un solo link"), no una
                  zona más adentro del mockup. */}
              <div className="text-center mb-6">
                <span className="inline-block font-mono text-xs font-semibold tracking-widest text-brand-accent bg-brand-accent-soft rounded-full px-3 py-1.5 mb-2.5">
                  TU LINK
                </span>
                <p className="font-mono text-base text-brand-accent">marcolini.lat/c/valentina</p>
              </div>
              <div className="flex justify-center mb-10">
                <Link
                  href="/registro/creador"
                  className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition"
                >
                  Crear mi vitrina
                  <IconArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="max-w-sm mx-auto rounded-[2rem] border border-brand-line bg-brand-surface shadow-[0_30px_60px_-30px_rgba(0,0,0,0.25)] p-6 sm:p-7">
                {/* Zona 1 — usuaria. Círculo de foto (icono, no una
                    inicial) porque acá se ilustra el caso completo de
                    la vitrina, con foto de perfil puesta — distinto del
                    estado real "sin foto todavía" que sí usa
                    VitrinaLivePreview dentro del portal. El link ya no
                    va acá — subió arriba del CTA. */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-brand-accent-soft text-brand-accent flex items-center justify-center mx-auto mb-2.5">
                    <IconPhoto className="w-7 h-7" />
                  </div>
                  <p className="font-display font-semibold text-brand-ink mb-2">@valentina</p>
                  <p className="font-display text-lg font-semibold text-brand-ink text-balance">
                    Mis favoritos de skincare y beauty ✨
                  </p>
                </div>

                {/* Zona 2 — tus códigos activos. La nota flota lejos del
                    mockup, centrada a la altura de esta zona (no
                    pegada arriba), con una línea que la conecta
                    directo con el borde — así se ve, a simple vista,
                    a qué franja del mockup corresponde. */}
                <div className="relative">
                  {/* En mobile, sin espacio para flotar, la nota se
                      convierte en su propia burbuja (mismo look que los
                      satélites del hero: tarjeta blanca, borde, sombra)
                      en vez de texto suelto sobre el fondo — en lg+ se
                      despoja de esos estilos y vuelve a ser la nota
                      flotante conectada con línea. */}
                  <div className="mb-4 lg:mb-0 bg-brand-surface border border-brand-line shadow-lg rounded-2xl p-4 lg:bg-transparent lg:border-0 lg:shadow-none lg:rounded-none lg:p-0 lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-full lg:w-64 lg:flex lg:items-center lg:gap-4">
                    <div className="lg:text-right">
                      <span className="inline-block font-mono text-xs font-semibold tracking-widest text-brand-accent bg-brand-accent-soft rounded-full px-3 py-1.5">
                        TUS CÓDIGOS ACTIVOS
                      </span>
                      <p className="text-sm text-brand-ink-soft leading-relaxed mt-2">
                        Todos tus códigos de descuento se organizan automáticamente en tu vitrina,
                        para que tu comunidad siempre tenga acceso al código correcto de cada
                        marca.
                      </p>
                    </div>
                    <span aria-hidden className="hidden lg:block flex-1 min-w-[2.5rem] h-px bg-brand-accent/40" />
                  </div>
                  <div className="space-y-3 mb-6">
                    {previewVitrinaMarcas.map((m) => (
                      <div key={m.marca} className="rounded-xl border border-brand-line bg-brand-bg px-4 py-3.5">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-full bg-brand-accent-soft text-brand-accent font-display text-xs font-semibold flex items-center justify-center shrink-0">
                            {m.marca
                              .split(" ")
                              .map((w) => w[0])
                              .join("")}
                          </div>
                          <p className="text-sm font-medium text-brand-ink">{m.marca}</p>
                        </div>
                        <p className="text-xs text-brand-ink-soft mb-2.5">
                          Obtén {m.descuento}% de descuento con esta marca usando mi código{" "}
                          <span className="font-mono font-medium text-brand-accent">{m.code}</span>
                        </p>
                        <p className="text-center text-xs font-semibold text-white bg-brand-accent rounded-full py-2">
                          Ir a la tienda →
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Zona 3 — tus colecciones. Mismo tratamiento que la
                    Zona 2, en espejo hacia la derecha. */}
                <div className="relative">
                  {/* Mismo tratamiento que la Zona 2: burbuja en mobile,
                      nota flotante conectada con línea en lg+. */}
                  <div className="mb-4 lg:mb-0 bg-brand-surface border border-brand-line shadow-lg rounded-2xl p-4 lg:bg-transparent lg:border-0 lg:shadow-none lg:rounded-none lg:p-0 lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:left-full lg:w-64 lg:flex lg:items-center lg:gap-4">
                    <span aria-hidden className="hidden lg:block flex-1 min-w-[2.5rem] h-px bg-brand-accent/40" />
                    <div>
                      <span className="inline-block font-mono text-xs font-semibold tracking-widest text-brand-accent bg-brand-accent-soft rounded-full px-3 py-1.5">
                        TUS COLECCIONES
                      </span>
                      <p className="text-sm text-brand-ink-soft leading-relaxed mt-2">
                        Crea colecciones con tus productos favoritos y organízalos por tema, rutina
                        o estilo. Comparte recomendaciones mucho más útiles y convierte tu vitrina
                        en una verdadera guía de compra para tu comunidad.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-brand-ink mb-0.5">{previewColeccion.nombre}</p>
                  <p className="text-xs text-brand-ink-soft mb-3">{previewColeccion.descripcion}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {previewColeccion.productos.map((p) => (
                      <div key={p.nombre} className="rounded-xl border border-brand-line overflow-hidden">
                        <div className="aspect-square bg-brand-bg flex items-center justify-center">
                          <IconProduct className="w-8 h-8 text-brand-ink-soft/35" />
                        </div>
                        <div className="p-2.5">
                          <p className="text-[10px] text-brand-ink-soft mb-0.5">{p.marca}</p>
                          <p className="text-xs font-medium text-brand-ink leading-snug mb-1.5">{p.nombre}</p>
                          <p className="font-mono text-xs font-semibold text-brand-accent mb-2">{p.precio}</p>
                          <p className="text-[10px] font-semibold text-center rounded-full py-1.5 bg-brand-accent-soft text-brand-accent">
                            Ver en tienda →
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                <p className="font-display font-semibold text-brand-ink mb-1">Meta de agosto — Aurora Beauty</p>
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
                  Gana bonos adicionales por cumplir metas de venta
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Además de tus comisiones, las marcas pueden lanzar campañas con objetivos y
                  recompensas especiales. Sigue tu progreso en tiempo real y, cuando alcances la
                  meta, el bono se acredita automáticamente a tu saldo junto con tus comisiones.
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
                  Lleva el control de tus comisiones en tiempo real
                </h3>
                <p className="text-brand-ink-soft leading-relaxed">
                  Cada venta aparece automáticamente en tu panel con la marca, el valor de tu
                  comisión, el estado del pago y tu saldo acumulado. Siempre sabrás cuánto has
                  ganado, cuánto está pendiente y cuándo recibirás tu próximo pago.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Preguntas frecuentes — acordeón (FaqAccordion): preguntas
            cerradas por defecto, se abren al hacer clic para leer la
            respuesta. */}
        <section className="max-w-3xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
            Preguntas frecuentes
          </h2>
          <FaqAccordion items={faq} />
        </section>

        {/* Cierre — misma estructura que /para-marcas (tarjeta oscura). */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
            />
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-9 text-balance">
              Convierte tu contenido e influencia en dinero.
            </h2>
            <Link
              href="/registro/creador"
              className="relative inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition"
            >
              Crear mi perfil gratis
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
