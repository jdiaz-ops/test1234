"use client";

import { useState } from "react";

/// Chip clicable con el código de descuento — antes solo aparecía como texto
/// dentro de la frase "usando mi código X", que la gente tenía que
/// seleccionar y copiar a mano (fácil de transcribir mal). Vive en la
/// vitrina pública (/c/[slug]), fuera del sistema de diseño de marca —
/// recibe los colores de la paleta que el creador eligió, igual que el
/// resto de esa página.
export function CopyCodeChip({
  code,
  accent,
  accentSoft,
}: {
  code: string;
  accent: string;
  accentSoft: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // portapapeles no disponible — no rompe la página
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-full pl-3 pr-2.5 py-1.5 font-mono text-xs font-semibold"
      style={{
        background: accentSoft,
        color: accent,
        border: `1px solid ${accent}`,
      }}
    >
      {code}
      <span className="text-[10px] font-sans font-medium">
        {copied ? "¡Copiado! ✓" : "Copiar"}
      </span>
    </button>
  );
}
