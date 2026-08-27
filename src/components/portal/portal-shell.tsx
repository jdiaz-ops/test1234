"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/// El shell compartido de sidebar+contenido para /admin, /creador y /marca.
/// Antes cada layout tenía un <aside className="w-64 shrink-0" ...> siempre
/// visible — en mobile ese ancho fijo de 256px le dejaba al contenido
/// principal apenas ~130px (viewport típico de 390px), volviéndolo
/// ilegible ("espichado"). Ahora en mobile el sidebar es un drawer
/// off-canvas (oculto por defecto, se abre con el botón de hamburguesa) y
/// el contenido usa el ancho completo; en desktop (lg+) sigue siendo el
/// sidebar fijo de siempre, sin cambios visuales.
export function PortalShell({
  logoHref = "/",
  logoLabel,
  centerAction,
  nav,
  footer,
  children,
}: {
  logoHref?: string;
  logoLabel: string;
  // Botón destacado al centro de la barra superior mobile — hoy solo lo
  // usa /marca mientras el onboarding no esté completo ("Terminar
  // onboarding"), visible en cualquier página del portal sin tener que
  // abrir el menú para encontrar el link "Empieza aquí".
  centerAction?: { label: string; href: string };
  nav: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Cierra el drawer al navegar (click en un link del nav, o back/forward
  // del navegador) — si no, queda abierto tapando la página nueva. Ajuste
  // de estado durante el render (patrón recomendado por React para
  // "resetear" al cambiar una prop), no en un efecto: evita el
  // doble-render de un setState síncrono dentro de useEffect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      {/* Barra superior — solo mobile. En desktop el logo vive dentro del
          sidebar fijo, como siempre. Hamburguesa a la izquierda (columna
          fija), logo a la derecha (columna fija), y centerAction — cuando
          se pasa — centrado en la columna elástica del medio; grid en vez
          de flex justify-between para que el logo se quede pegado a la
          derecha exista o no el botón central. */}
      <div className="lg:hidden sticky top-0 z-30 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-brand-line bg-brand-surface px-4 h-14 shrink-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="col-start-1 justify-self-start p-2 -ml-2 text-brand-ink"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {centerAction && (
          <Link
            href={centerAction.href}
            className="col-start-2 justify-self-center inline-flex items-center bg-brand-accent text-white text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap hover:opacity-90 transition"
          >
            {centerAction.label}
          </Link>
        )}
        <Link href={logoHref} className="col-start-3 justify-self-end">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
          <img
            src="/marcolini-icon.png"
            alt={logoLabel}
            className="h-7 w-auto"
          />
        </Link>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Fondo oscuro detrás del drawer — cierra al tocar afuera. */}
        {open && (
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
          />
        )}

        <aside
          className={`w-64 shrink-0 border-r border-brand-line bg-brand-surface p-5 flex flex-col overflow-y-auto
            fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out
            lg:static lg:z-auto lg:translate-x-0
            ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between mb-8 lg:hidden">
            {/* Este header (logo + botón de cerrar) vive dentro del
                <aside>, pero solo hace falta en el drawer mobile — en
                desktop el logo ahora vive en la franja de arriba, no
                acá (ver más abajo). */}
            <Link href={logoHref}>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
              <img
                src="/marcolini-icon.png"
                alt={logoLabel}
                className="h-7 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="p-1 -mr-1 text-brand-ink-soft"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {nav}
          <div className="mt-auto pt-5 border-t border-brand-line">
            {footer}
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-brand-bg flex flex-col">
          {/* Franja superior — solo desktop (mobile ya tiene su propia
              barra con el logo, sin cambios). El logo vive acá en vez de
              en el sidebar (ver arriba, lg:hidden en ese header). */}
          <div className="hidden lg:flex justify-end px-8 py-3 border-b border-brand-line bg-brand-surface">
            <Link href={logoHref}>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
              <img
                src="/marcolini-icon.png"
                alt={logoLabel}
                className="h-7 w-auto"
              />
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
