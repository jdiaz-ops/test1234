import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const beneficios = [
  {
    titulo: "Solo pagas si hay venta",
    texto:
      "Modelo 100% por resultado — sin cuota fija, sin riesgo de probarlo con tu marca.",
  },
  {
    titulo: "Comisión a tu medida",
    texto:
      "Define un % general para todos, o negocia uno distinto con tus creadores clave.",
  },
  {
    titulo: "Creadores ya organizados",
    texto:
      "Accede a una red de creadores de belleza sin tener que buscarlos ni convencerlos uno por uno.",
  },
  {
    titulo: "Conectado a tu tienda",
    texto:
      "Integración con Shopify y WooCommerce — el código de cada creador se crea solo, sin trabajo manual.",
  },
  {
    titulo: "Dashboard con ROI claro",
    texto:
      "Ve cuánto vendiste, cuántos embajadores nuevos se unieron, y cuánto te cuesta cada venta antes de aprobarla.",
  },
  {
    titulo: "Retos y campañas",
    texto:
      "Activa bonos, leaderboards o comisión elevada por tiempo limitado cuando quieras impulsar ventas.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Configura tu oferta",
    texto: "Define tu comisión y el descuento del código — general o por creador.",
  },
  {
    paso: "2",
    titulo: "Los creadores se unen",
    texto: "Promocionan tu marca con su propio código, único en toda la red.",
  },
  {
    paso: "3",
    titulo: "Pagas por resultado",
    texto: "Cobro automático el día 1, con 15 días de colchón antes de pagarles a ellos.",
  },
];

export default function ParaMarcasPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="font-mono text-xs text-brand-accent tracking-widest mb-5">
            PARA MARCAS
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-ink mb-5 text-balance leading-tight">
            Solo pagas cuando hay una venta real
          </h1>
          <p className="text-brand-ink-soft text-lg max-w-xl mx-auto mb-9">
            Crea tu propio programa de afiliados y llega a creadores de
            belleza reales — sin gastar en pauta que no convierte.
          </p>
          <div className="flex items-center justify-center gap-6">
            <Link
              href="/registro/marca"
              className="bg-brand-accent text-white rounded-full px-7 py-3 text-sm font-medium hover:opacity-90"
            >
              Únete gratis
            </Link>
            <Link href="/login" className="text-sm text-brand-ink-soft hover:underline">
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        {/* Beneficios */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-brand-line">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {beneficios.map((b) => (
              <div key={b.titulo} className="rounded-2xl bg-brand-surface border border-brand-line p-6">
                <p className="font-display font-semibold text-brand-ink mb-2">{b.titulo}</p>
                <p className="text-sm text-brand-ink-soft leading-relaxed">{b.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="max-w-4xl mx-auto px-6 py-16 border-t border-brand-line">
          <h2 className="font-display text-2xl font-semibold text-brand-ink text-center mb-10">
            Cómo funciona
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {pasos.map((p) => (
              <div key={p.paso} className="text-center">
                <div className="font-mono text-brand-accent text-sm mb-3">{p.paso}</div>
                <p className="font-display font-semibold text-brand-ink mb-2">{p.titulo}</p>
                <p className="text-sm text-brand-ink-soft leading-relaxed">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tarifa transparente */}
        <section className="max-w-3xl mx-auto px-6 py-16 border-t border-brand-line text-center">
          <p className="font-mono text-sm text-brand-accent mb-3">5% + IVA</p>
          <h2 className="font-display text-2xl font-semibold text-brand-ink mb-4">
            Una sola tarifa, sin costos ocultos
          </h2>
          <p className="text-brand-ink-soft max-w-xl mx-auto mb-9">
            Pagas la comisión que definiste para tus creadores, más una tarifa
            de plataforma del 5% + IVA — nunca se descuenta de lo que gana el
            creador.
          </p>
          <Link
            href="/registro/marca"
            className="inline-block bg-brand-accent text-white rounded-full px-7 py-3 text-sm font-medium hover:opacity-90"
          >
            Únete gratis
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
