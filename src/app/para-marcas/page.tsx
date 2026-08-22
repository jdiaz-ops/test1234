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
} from "@/components/marketing/icons";

const beneficios = [
  {
    icon: IconTarget,
    titulo: "Paga solo por resultados",
    texto: "5% únicamente sobre las ventas generadas.",
  },
  {
    icon: IconUsers,
    titulo: "Creadores especializados",
    texto: "Llega a una comunidad enfocada 100% en uñas.",
  },
  {
    icon: IconStore,
    titulo: "Conecta tu Shopify",
    texto: "Integra tu tienda y lanza campañas en minutos.",
  },
  {
    icon: IconTrace,
    titulo: "Trazabilidad total",
    texto: "Conoce quién vendió, cuánto vendió y cuánto pagar.",
  },
  {
    icon: IconSliders,
    titulo: "Define tu comisión",
    texto: "Tú eliges el porcentaje que recibirán los creadores.",
  },
  {
    icon: IconTrendingUp,
    titulo: "Escala tu ecommerce",
    texto: "Convierte el marketing de influencia en ventas medibles.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Crea tu programa",
    texto: "Conecta tu tienda Shopify.",
  },
  {
    paso: "2",
    titulo: "Define la comisión",
    texto: "Elige el % que ofrecerás a los creadores.",
  },
  {
    paso: "3",
    titulo: "Los creadores recomiendan",
    texto: "Promocionan tus productos con enlaces únicos.",
  },
  {
    paso: "4",
    titulo: "Paga solo por ventas confirmadas",
    texto: "La comisión del creador + 5% sobre la venta.",
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
              PARA MARCAS DE UÑAS
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-semibold text-brand-ink mb-6 text-balance leading-[1.08]">
              Convierte a los creadores de contenido de uñas en un canal de ventas para tu marca
            </h1>
            <p className="text-brand-ink-soft text-lg sm:text-xl max-w-xl mx-auto mb-10 text-balance">
              Activa tu programa de afiliados y conecta con una red
              especializada de creadores. <span className="text-brand-ink font-medium">Sin mensualidades. Solo pagas cuando vendes.</span>
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
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
          </div>
        </section>

        {/* Beneficios */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <p className="font-mono text-xs text-brand-accent tracking-widest text-center mb-3">
            ¿POR QUÉ UNIRTE?
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

        {/* Tarifa transparente */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="rounded-3xl bg-brand-ink text-white px-8 py-16 text-center relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-24 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
            />
            <p className="relative font-mono text-sm text-brand-accent mb-3 tracking-wide">5% + IVA</p>
            <h2 className="relative font-display text-2xl sm:text-3xl font-semibold mb-4 text-balance">
              Una sola tarifa, sin costos ocultos
            </h2>
            <p className="relative text-white/70 max-w-xl mx-auto mb-9 text-balance">
              Pagas la comisión que definiste para tus creadores, más una
              tarifa de plataforma del 5% + IVA — nunca se descuenta de lo
              que gana el creador.
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
