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
          <h1 className="font-display text-4xl sm:text-6xl font-semibold text-brand-ink mb-6 text-balance leading-[1.08]">
            La red que conecta marcas de uñas y creadores de contenido
          </h1>
          <p className="text-brand-ink-soft text-lg sm:text-xl max-w-xl mx-auto mb-14 text-balance">
            Creadores ganan comisiones por las ventas que generan. Las marcas
            pagan únicamente por resultados.
          </p>

          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            <Link
              href="/para-creadores"
              className="group rounded-2xl border border-brand-line bg-brand-surface p-7 text-left hover:border-brand-accent hover:shadow-[0_20px_50px_-28px_var(--brand-accent)] transition"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-accent-soft text-brand-accent flex items-center justify-center mb-5 group-hover:scale-105 transition">
                <IconHeart className="w-5 h-5" />
              </div>
              <p className="font-mono text-xs text-brand-ink-soft tracking-widest mb-2">
                SOY CREADOR
              </p>
              <p className="font-display text-lg font-semibold text-brand-ink mb-4 text-balance">
                Gana comisiones por tus recomendaciones
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
              <p className="font-display text-lg font-semibold text-brand-ink mb-4 text-balance">
                Crea tu programa de afiliados
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
