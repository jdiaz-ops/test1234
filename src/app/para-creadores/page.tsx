import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  IconLayers,
  IconPercent,
  IconWallet,
  IconChart,
  IconGift,
  IconHeart,
  IconArrowRight,
} from "@/components/marketing/icons";

const beneficios = [
  {
    icon: IconLayers,
    titulo: "Múltiples marcas",
    texto: "Accede a campañas de decenas de marcas desde un solo perfil.",
  },
  {
    icon: IconPercent,
    titulo: "Comisión por ventas reales",
    texto: "Participa en cada venta que generes, con trazabilidad total.",
  },
  {
    icon: IconWallet,
    titulo: "Un solo saldo",
    texto: "Todas tus comisiones se acumulan y recibes un único pago mensual.",
  },
  {
    icon: IconChart,
    titulo: "Estadísticas de desempeño",
    texto: "Conoce cuánto vendes, tu conversión y tus ingresos en tiempo real.",
  },
  {
    icon: IconGift,
    titulo: "Campañas y bonos",
    texto: "Accede a retos e incentivos exclusivos activados por las marcas.",
  },
  {
    icon: IconHeart,
    titulo: "100% gratis",
    texto: "Nunca pagas por pertenecer a la red.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Crea tu perfil",
    texto: "Regístrate y obtén tu código único.",
  },
  {
    paso: "2",
    titulo: "Únete a campañas",
    texto: "Elige las marcas que quieras recomendar.",
  },
  {
    paso: "3",
    titulo: "Comparte y gana",
    texto: "Cada venta verificada genera comisión automáticamente.",
  },
];

export default function ParaCreadoresPage() {
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
              PARA CREADORAS
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-semibold text-brand-ink mb-6 text-balance leading-[1.08]">
              Convierte tus recomendaciones en ingresos reales
            </h1>
            <p className="text-brand-ink-soft text-lg sm:text-xl max-w-xl mx-auto mb-10 text-balance">
              Únete gratis a la red de creadoras de belleza y gana comisión
              por cada venta verificada de las marcas que recomiendas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <Link
                href="/registro/creador"
                className="group inline-flex items-center gap-2 bg-brand-accent text-white rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition shadow-[0_10px_30px_-10px_var(--brand-accent)]"
              >
                Únete gratis
                <IconArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/login" className="text-sm text-brand-ink-soft hover:text-brand-ink hover:underline">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>

        {/* Beneficios */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
            BENEFICIOS
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-12 text-balance">
            Todo lo que necesitas para monetizar tu contenido
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
        <section className="max-w-4xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand-ink text-center mb-14">
            Cómo funciona
          </h2>
          <div className="grid sm:grid-cols-3 gap-10 relative">
            <div
              aria-hidden
              className="hidden sm:block absolute top-6 left-[16.5%] right-[16.5%] h-px bg-brand-line"
            />
            {pasos.map((p) => (
              <div key={p.paso} className="relative text-center">
                <div className="relative z-10 w-12 h-12 mx-auto rounded-full bg-brand-accent text-white font-mono text-sm font-semibold flex items-center justify-center mb-5">
                  {p.paso}
                </div>
                <p className="font-display font-semibold text-brand-ink mb-2">{p.titulo}</p>
                <p className="text-sm text-brand-ink-soft leading-relaxed max-w-[220px] mx-auto">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -right-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
            />
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-3 text-balance">
              Tu comunidad ya confía en ti.
              <br className="hidden sm:block" /> Ahora también puede generar ingresos.
            </h2>
            <p className="relative text-white/70 mb-8 max-w-md mx-auto">
              Crea tu perfil gratis y empieza a ganar comisión hoy mismo.
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
