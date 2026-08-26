import Link from "next/link";

/// ctaHref/ctaLabel son opcionales porque el header se comparte entre
/// /para-marcas y /para-creadores — cada landing manda a un registro
/// distinto (/registro/marca vs /registro/creador), así que el botón de
/// "empieza gratis" del header lo decide la página, no el componente.
/// Sin props, el header queda como estaba (solo "Ya tengo cuenta").
export function SiteHeader({ ctaHref, ctaLabel }: { ctaHref?: string; ctaLabel?: string } = {}) {
  return (
    <header className="border-b border-brand-line bg-brand-surface/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm font-medium text-brand-accent tracking-wide">
          MARCOLINI
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/para-creadores" className="text-brand-ink-soft hover:text-brand-ink">
            Para Creadores
          </Link>
          <Link href="/para-marcas" className="text-brand-ink-soft hover:text-brand-ink">
            Para Marcas
          </Link>
          <Link
            href="/login"
            className="text-brand-ink font-medium border border-brand-line rounded-full px-4 py-1.5 hover:bg-brand-accent-soft"
          >
            Ya tengo cuenta
          </Link>
          {ctaHref && ctaLabel && (
            // Oculto en mobile: con los otros 3 elementos del nav ya no
            // cabe (se desborda y corta el botón) — y en mobile el CTA
            // del hero queda a la vista inmediata, justo debajo.
            <Link
              href={ctaHref}
              className="hidden sm:inline-flex bg-brand-accent text-white font-medium rounded-full px-4 py-1.5 hover:opacity-90 transition"
            >
              {ctaLabel}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
