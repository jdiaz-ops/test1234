import Link from "next/link";
import { SiteFooter } from "@/components/marketing/site-footer";
import { IconHeart, IconStore, IconArrowRight } from "@/components/marketing/icons";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6 py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[840px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand-accent-soft), transparent)" }}
        />

        <div className="relative max-w-3xl w-full text-center">
          <p className="font-mono text-sm font-medium text-brand-accent tracking-widest mb-7">
            MARCOLINI
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold text-brand-ink mb-14 text-balance leading-[1.08]">
            Donde las marcas crecen y los creadores de contenido monetizan.
          </h1>

          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            <Link
              href="/para-creadores"
              className="group rounded-2xl border border-brand-line bg-brand-surface p-7 text-left hover:border-brand-accent hover:shadow-[0_20px_50px_-28px_var(--brand-accent)] transition"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-5 group-hover:scale-105 transition">
                <IconHeart className="w-5 h-5" />
              </div>
              <p className="font-mono text-xs text-brand-ink-soft tracking-widest mb-2">
                PARA CREADORES
              </p>
              <p className="font-display text-lg font-semibold text-brand-ink mb-2 text-balance">
                Convierte tu contenido e influencia en dinero
              </p>
              <p className="text-sm text-brand-ink-soft leading-relaxed mb-4">
                Obtén códigos de descuento para tu comunidad y gana una comisión por cada compra
                que realicen con ellos.
              </p>
              <p className="text-sm text-brand-accent font-medium inline-flex items-center gap-1.5">
                Únete gratis
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>

            <Link
              href="/para-marcas"
              className="group rounded-2xl border border-brand-line bg-brand-surface p-7 text-left hover:border-brand-accent hover:shadow-[0_20px_50px_-28px_var(--brand-accent)] transition"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-5 group-hover:scale-105 transition">
                <IconStore className="w-5 h-5" />
              </div>
              <p className="font-mono text-xs text-brand-ink-soft tracking-widest mb-2">
                SOY MARCA
              </p>
              <p className="font-display text-lg font-semibold text-brand-ink mb-2 text-balance">
                Crece tu e‑commerce conectando tu marca con nuestra red de creadores de contenido
              </p>
              <p className="text-sm text-brand-ink-soft leading-relaxed mb-4">
                Solo pagas comisión cuando generan ventas.
              </p>
              <p className="text-sm text-brand-accent font-medium inline-flex items-center gap-1.5">
                Sin mensualidad
                <IconArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
