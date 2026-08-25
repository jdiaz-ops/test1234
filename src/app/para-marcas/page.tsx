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
} from "@/components/marketing/icons";

const confianza = [
  "Solo pagas cuando vendes",
  "5 minutos de configuración",
  "Ventas 100% trazables",
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
    titulo: "Invierte con confianza",
    texto: "Destina presupuesto a quienes convierten.",
  },
];

const beneficios = [
  {
    icon: IconTarget,
    titulo: "Paga solo por resultados",
    texto: "5% únicamente sobre las ventas generadas.",
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
    texto: "Quién vendió, cuánto vendió y cuánto pagar.",
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
    texto: "Comparten enlaces únicos y generan pedidos.",
  },
  {
    paso: "4",
    titulo: "Mide y paga",
    texto: "Paga únicamente las ventas confirmadas.",
  },
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
              PARA MARCAS DE UÑAS · SHOPIFY &amp; WOOCOMMERCE
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
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {confianza.map((texto) => (
                <span key={texto} className="inline-flex items-center gap-1.5 text-xs text-brand-ink-soft">
                  <IconCheck className="w-4 h-4 text-brand-accent shrink-0" />
                  {texto}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* El problema */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
            EL PROBLEMA
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-4 text-balance">
            Deja de adivinar qué creadores realmente hacen vender
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
            <p className="relative font-mono text-sm text-brand-accent mb-3 tracking-wide">5% + IVA</p>
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
              Una sola tarifa. Sin mensualidades.
            </h2>
            <p className="relative text-white/70 max-w-xl mx-auto mb-9 text-balance">
              Tú defines la comisión del creador. Marcolini solo cobra un 5% sobre las ventas
              generadas. Nunca descontamos dinero de lo que gana el creador.
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
