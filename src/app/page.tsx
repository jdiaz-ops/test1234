import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconHeart, IconStore, IconArrowRight } from "@/components/marketing/icons";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6 py-24">
        {/* Antes un único blob centrado arriba — plano. Dos blobs
            asimétricos (uno grande arriba-izquierda, uno más chico
            abajo-derecha, distinta opacidad) le dan profundidad a la
            página sin salir de la paleta de marca (solo brand-accent). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 -left-40 h-[560px] w-[720px] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-56 -right-32 h-[500px] w-[640px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand-accent), transparent)" }}
        />

        <div className="relative max-w-4xl w-full text-center">
          <p className="font-mono text-sm font-medium text-brand-accent tracking-widest mb-7">
            MARCOLINI
          </p>
          {/* Split de color en vez de un bloque de texto plano — "crecen" y
              "monetizan" en el rosado de marca, el resto en tinta, para que
              el H1 tenga un punto de énfasis en vez de un solo peso visual
              parejo de principio a fin. */}
          <h1 className="font-display text-5xl sm:text-7xl font-semibold text-brand-ink mb-16 text-balance leading-[1.05] tracking-tight">
            Donde las marcas <span className="text-brand-accent">crecen</span> y los creadores de
            contenido <span className="text-brand-accent">monetizan</span>.
          </h1>

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {/* Tarjeta creador — ya no es solo texto: incluye una miniatura
                real del "Tu resumen" del hero de /para-creadores (mismas
                cifras: Comisión confirmada $340.000), para que de un
                vistazo se sienta el producto, no solo se lea sobre él. */}
            <Link
              href="/para-creadores"
              className="group rounded-3xl border border-brand-line bg-brand-surface p-8 text-left hover:border-brand-accent hover:shadow-[0_30px_70px_-32px_var(--brand-accent)] hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <IconHeart className="w-5 h-5" />
              </div>
              <p className="font-mono text-xs text-brand-ink-soft tracking-widest mb-2">
                PARA CREADORES
              </p>
              <p className="font-display text-xl font-semibold text-brand-ink mb-2 text-balance">
                Convierte tu contenido e influencia en dinero
              </p>
              <p className="text-sm text-brand-ink-soft leading-relaxed mb-6">
                Obtén códigos de descuento para tu comunidad y gana una comisión por cada compra
                que realicen con ellos.
              </p>
              <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-6">
                <p className="text-xs text-brand-ink-soft mb-0.5">Comisión confirmada</p>
                <p className="font-display text-xl font-bold text-brand-accent">$340.000</p>
              </div>
              <p className="text-sm text-brand-accent font-semibold inline-flex items-center gap-1.5">
                Únete gratis
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>

            {/* Tarjeta marca — mismo tratamiento, con la miniatura real del
                "Resultado de la campaña" de /para-marcas (3.8x ROI). */}
            <Link
              href="/para-marcas"
              className="group rounded-3xl border border-brand-line bg-brand-surface p-8 text-left hover:border-brand-accent hover:shadow-[0_30px_70px_-32px_var(--brand-accent)] hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <IconStore className="w-5 h-5" />
              </div>
              <p className="font-mono text-xs text-brand-ink-soft tracking-widest mb-2">
                SOY MARCA
              </p>
              <p className="font-display text-xl font-semibold text-brand-ink mb-2 text-balance">
                Crece tu e‑commerce conectando tu marca con nuestra red de creadores de contenido
              </p>
              <p className="text-sm text-brand-ink-soft leading-relaxed mb-6">
                Solo pagas comisión cuando generan ventas.
              </p>
              <div className="rounded-xl bg-brand-accent-soft px-4 py-3 mb-6">
                <p className="text-xs text-brand-ink-soft mb-0.5">Resultado de la campaña</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="font-display text-xl font-bold text-brand-accent">3.8x</p>
                  <p className="text-xs text-brand-ink-soft">en ventas por cada $1 invertido</p>
                </div>
              </div>
              <p className="text-sm text-brand-accent font-semibold inline-flex items-center gap-1.5">
                Sin mensualidad
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </p>
            </Link>
          </div>

          <Link
            href="/login"
            className="text-sm text-brand-ink-soft hover:text-brand-accent hover:underline"
          >
            Ya tengo cuenta — Iniciar sesión
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
