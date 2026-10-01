"use client";

import { useEffect } from "react";
import { UTM_COOKIE, UTM_KEYS } from "@/lib/waitlist";

/// Guarda en una cookie (30 días) los utm_* del anuncio que trajo a la
/// persona, para saber de dónde llegó cuando se inscribe en la lista de
/// espera, aunque navegue por otras páginas antes. Solo el primer anuncio
/// cuenta: si la cookie ya existe no se pisa. Ver src/lib/waitlist.ts.
export function UtmCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split("; ").some((c) => c.startsWith(`${UTM_COOKIE}=`))) return;
      const params = new URLSearchParams(window.location.search);
      const data: Record<string, string> = {};
      for (const key of UTM_KEYS) {
        const value = params.get(key);
        if (value) data[key] = value.slice(0, 200);
      }
      if (!data.utm_source) return;
      if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
        data.referrer = document.referrer.slice(0, 200);
      }
      document.cookie = `${UTM_COOKIE}=${encodeURIComponent(JSON.stringify(data))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {
      // Sin cookies no pasa nada: la inscripción queda como "Directo".
    }
  }, []);
  return null;
}
