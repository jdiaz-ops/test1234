import Link from "next/link";

/// ctaHref/ctaLabel son opcionales porque el header se comparte entre
/// /para-marcas y /para-creadores — cada landing manda a un registro
/// distinto (/registro/marca vs /registro/creador), así que el botón de
/// "empieza gratis" del header lo decide la página, no el componente.
/// Sin props, el header queda como estaba (solo "Ya tengo cuenta").
///
/// loginHref/loginLabel: mismo patrón, para que cada landing pueda
/// personalizar el link de "ya tengo cuenta" (ej. "Acceder Portal
/// Creadores" en /para-creadores) sin tocar el componente compartido.
/// mobileCtaLabel/mobileLoginLabel: versiones cortas solo para mobile
/// (ej. "Crear mi perfil" en vez de "Únete gratis", "Portal Creadores"
/// en vez de "Acceder Portal Creadores") — en desktop se sigue viendo
/// la versión completa.
/// showRoleLinks: "Soy Creador"/"Soy Marca" ya estaban ocultos en mobile
/// (no cabían); en /para-creadores tampoco se quieren en desktop —
/// estando ya en esa landing son redundantes. Default true para no
/// afectar a /para-marcas, que sí los conserva en desktop.
export function SiteHeader({
  ctaHref,
  ctaLabel,
  mobileCtaLabel,
  loginHref = "/login",
  loginLabel = "Ya tengo cuenta",
  mobileLoginLabel,
  showRoleLinks = true,
}: {
  ctaHref?: string;
  ctaLabel?: string;
  mobileCtaLabel?: string;
  loginHref?: string;
  loginLabel?: string;
  mobileLoginLabel?: string;
  showRoleLinks?: boolean;
} = {}) {
  return (
    // z-20, no z-10: con el mismo z-index que las tarjetas satélite
    // absolutas del hero (también z-10), gana quien esté más abajo en el
    // DOM — las satélites, no el header — así que al hacer scroll pasaban
    // por encima del menú en vez de quedar debajo del header sticky.
    <header className="border-b border-brand-line bg-brand-surface/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6">
        {/* Una sola fila también en mobile (antes había una segunda fila
            solo para el link de cuenta, que hacía el header más grueso).
            Los dos botones — cuenta y CTA — van juntos a la derecha, cada
            uno con su label corto en mobile (mobileLoginLabel/
            mobileCtaLabel) y padding más chico para que quepan al lado
            del logo sin desbordar. */}
        <div className="h-16 flex items-center justify-between gap-2 sm:gap-3">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
            <img src="/marcolini-icon.png" alt="Marcolini" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6 text-sm">
            {/* "Soy Creador"/"Soy Marca" ocultos en mobile siempre: en una
                barra angosta compiten por espacio con el link de cuenta y
                el CTA. En desktop, showRoleLinks=false los quita también
                (ej. /para-creadores: ya estando ahí, son redundantes). */}
            {showRoleLinks && (
              <>
                <Link href="/para-creadores" className="hidden sm:inline text-brand-ink-soft hover:text-brand-ink">
                  Soy Creador
                </Link>
                <Link href="/para-marcas" className="hidden sm:inline text-brand-ink-soft hover:text-brand-ink">
                  Soy Marca
                </Link>
              </>
            )}
            <Link
              href={loginHref}
              className="inline-flex items-center text-brand-ink font-medium border border-brand-line rounded-full px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm hover:bg-brand-accent-soft whitespace-nowrap"
            >
              <span className="sm:hidden">{mobileLoginLabel ?? loginLabel}</span>
              <span className="hidden sm:inline">{loginLabel}</span>
            </Link>
            {ctaHref && ctaLabel && (
              <Link
                href={ctaHref}
                className="inline-flex items-center bg-brand-accent text-white font-medium rounded-full px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm hover:opacity-90 transition whitespace-nowrap"
              >
                <span className="sm:hidden">{mobileCtaLabel ?? ctaLabel}</span>
                <span className="hidden sm:inline">{ctaLabel}</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
