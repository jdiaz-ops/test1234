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
/// mobileCtaLabel: versión corta del CTA solo para mobile (ej. "Crear mi
/// perfil" en vez de "Únete gratis") — en desktop se sigue viendo
/// ctaLabel.
export function SiteHeader({
  ctaHref,
  ctaLabel,
  mobileCtaLabel,
  loginHref = "/login",
  loginLabel = "Ya tengo cuenta",
}: {
  ctaHref?: string;
  ctaLabel?: string;
  mobileCtaLabel?: string;
  loginHref?: string;
  loginLabel?: string;
} = {}) {
  return (
    // z-20, no z-10: con el mismo z-index que las tarjetas satélite
    // absolutas del hero (también z-10), gana quien esté más abajo en el
    // DOM — las satélites, no el header — así que al hacer scroll pasaban
    // por encima del menú en vez de quedar debajo del header sticky.
    <header className="border-b border-brand-line bg-brand-surface/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
            <img src="/marcolini-icon.png" alt="Marcolini" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6 text-sm">
            {/* "Soy Creador"/"Soy Marca" ocultos en mobile: en una barra
                angosta compiten por espacio con el link de cuenta y el CTA
                — y en mobile ya se llega a estas landings desde el link
                correspondiente, así que son redundantes ahí. */}
            <Link href="/para-creadores" className="hidden sm:inline text-brand-ink-soft hover:text-brand-ink">
              Soy Creador
            </Link>
            <Link href="/para-marcas" className="hidden sm:inline text-brand-ink-soft hover:text-brand-ink">
              Soy Marca
            </Link>
            {/* En mobile el link de cuenta baja a la fila secundaria de
                abajo (ver más abajo) para no pelear por ancho con el CTA;
                en desktop se queda acá, como antes. */}
            <Link
              href={loginHref}
              className="hidden sm:inline-flex text-brand-ink font-medium border border-brand-line rounded-full px-4 py-1.5 hover:bg-brand-accent-soft"
            >
              {loginLabel}
            </Link>
            {ctaHref && ctaLabel && (
              // Visible también en mobile (antes hidden sm:inline-flex):
              // con "Soy Creador"/"Soy Marca" ocultos ahora sí cabe, y es
              // el llamado a la acción principal de la barra en mobile.
              <Link
                href={ctaHref}
                className="inline-flex bg-brand-accent text-white font-medium rounded-full px-4 py-1.5 hover:opacity-90 transition whitespace-nowrap"
              >
                <span className="sm:hidden">{mobileCtaLabel ?? ctaLabel}</span>
                <span className="hidden sm:inline">{ctaLabel}</span>
              </Link>
            )}
          </nav>
        </div>
        {/* Fila secundaria solo mobile: el link de cuenta, centrado y más
            discreto debajo de la fila principal — antes era una pill
            metida entre "Soy Creador"/"Soy Marca" y el CTA que no cabía
            bien en una barra angosta. */}
        <div className="sm:hidden pb-2.5 -mt-1 text-center">
          <Link href={loginHref} className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline">
            {loginLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
