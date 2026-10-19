"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SuggestionForm } from "@/components/portal/suggestion-form";

/// La nube de la esquina en todas las páginas del portal de marcas y del de
/// creadoras: abre ahí mismo el buzón de sugerencias, sin salir de lo que
/// estaban haciendo (pedido del 2026-10-19). La sugerencia guarda en qué
/// página estaban. `href` es la página completa del buzón (con lo que ya
/// enviaron).
export function SuggestionBubble({ href }: { href: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Al cambiar de página se cierra (patrón de "resetear" durante el
  // render, igual que PortalShell).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // En la propia página del buzón sobra.
  if (pathname.startsWith(href)) return null;

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="Buzón de sugerencias"
          className="w-[22rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-brand-line bg-brand-surface p-4 shadow-xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-semibold text-brand-ink">Buzón de sugerencias</p>
              <p className="text-xs text-brand-ink-soft">Escríbenos o mándanos una nota de voz. Lo leemos todo.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="-mr-1 -mt-1 rounded-full p-1 text-brand-ink-soft hover:text-brand-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <SuggestionForm compact />
          <Link href={href} className="mt-3 block text-xs text-brand-ink-soft hover:text-brand-accent hover:underline">
            Ver lo que ya nos enviaste →
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Cerrar el buzón de sugerencias" : "Envíanos una sugerencia"}
        title="Envíanos una sugerencia"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-white shadow-lg transition-transform hover:scale-105 motion-reduce:transition-none"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />
          <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
        </svg>
      </button>
    </div>
  );
}
