"use client";

import { useEffect, useState } from "react";
import type { ThemeConfig } from "@/lib/brand-theme";

/// Pop-up promocional — solo computadoras (igual que Tiendanube), se
/// muestra una vez por sesión de navegador (no en cada página) para no
/// ser invasivo. Sin registro a newsletter — ver la nota en
/// brand-theme.ts, esta plataforma no habla de marketing por correo.
export function PromoPopup({
  config,
  brandSlug,
}: {
  config: ThemeConfig["popup"];
  brandSlug: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!config.enabled || !config.imageUrl) return;
    const key = `marcolini_popup_seen_${brandSlug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decide si mostrar el pop-up según sessionStorage, solo se puede leer tras montar
      setOpen(true);
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage no disponible (modo privado) — simplemente no se
      // muestra el pop-up, no rompe nada.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, a propósito
  }, []);

  if (!open || !config.imageUrl) return null;

  return (
    <div className="hidden sm:flex fixed inset-0 z-50 items-center justify-center bg-black/50 p-6">
      <div className="relative max-w-md w-full bg-brand-surface rounded-2xl overflow-hidden shadow-xl">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
        >
          ×
        </button>
        <a href={config.link || "#"} onClick={(e) => !config.link && e.preventDefault()}>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen subida por la marca */}
          <img src={config.imageUrl} alt="" className="w-full h-auto" />
        </a>
        {config.phrase && (
          <p className="text-center font-display font-medium text-brand-ink p-4">
            {config.phrase}
          </p>
        )}
      </div>
    </div>
  );
}
