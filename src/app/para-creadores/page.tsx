import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

const beneficios = [
  {
    titulo: "Un solo código, todas las marcas",
    texto:
      "Tu código personal funciona igual en cada marca a la que te unes — nunca tienes que recordar ni compartir uno distinto por cada una.",
  },
  {
    titulo: "Tu propia vitrina",
    texto:
      "Una página pública con todas tus marcas activas. Es el único link que necesitas poner en tu bio.",
  },
  {
    titulo: "Comisión transparente",
    texto:
      "Ves por separado el descuento que le das a tu comunidad y la comisión que tú ganas — sin letra pequeña.",
  },
  {
    titulo: "Pago automático cada mes",
    texto:
      "El día 15 de cada mes se te paga directo a tu cuenta, sin que tengas que pedirlo.",
  },
  {
    titulo: "Retos con bonos extra",
    texto:
      "Compite en leaderboards y gana comisiones elevadas por tiempo limitado en las marcas que lo activen.",
  },
  {
    titulo: "Cobro anticipado",
    texto:
      "¿Necesitas tu pago antes del día 15? Adelántalo cuando quieras, por una pequeña tarifa.",
  },
];

const pasos = [
  {
    paso: "1",
    titulo: "Crea tu perfil",
    texto: "Regístrate y elige tu código personal — el mismo en todas las marcas.",
  },
  {
    paso: "2",
    titulo: "Únete a marcas",
    texto: "Explora el marketplace y únete a las ofertas que quieras promocionar.",
  },
  {
    paso: "3",
    titulo: "Comparte y cobra",
    texto: "Comparte tu código con tu comunidad — la comisión se calcula sola.",
  },
];

export default function ParaCreadoresPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="font-mono text-xs text-brand-accent tracking-widest mb-5">
            PARA CREADORES
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand-ink mb-5 text-balance leading-tight">
            Convierte tu contenido en ingreso real
          </h1>
          <p className="text-brand-ink-soft text-lg max-w-xl mx-auto mb-9">
            Tu comunidad ya confía en tus recomendaciones de belleza. Ahora
            puedes ganar comisión real por cada venta que generes.
          </p>
          <div className="flex items-center justify-center gap-6">
            <Link
              href="/registro/creador"
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

        {/* CTA final */}
        <section className="max-w-3xl mx-auto px-6 py-16 border-t border-brand-line text-center">
          <h2 className="font-display text-2xl font-semibold text-brand-ink mb-4">
            Tu primer código está a un registro de distancia
          </h2>
          <Link
            href="/registro/creador"
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
