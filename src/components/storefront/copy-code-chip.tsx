"use client";

import { useState } from "react";

/// Pequeño link "Copiar código" al lado del código de descuento — el
/// código en sí se muestra igual que antes (texto plano dentro de la
/// frase, en la vitrina pública); esto es solo el gatillo para copiarlo
/// sin tener que seleccionarlo a mano.
export function CopyCodeChip({
  code,
  accent,
}: {
  code: string;
  accent: string;
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
      className="text-xs font-medium hover:underline"
      style={{ color: accent }}
    >
      {copied ? "¡Copiado!" : "Copiar código"}
    </button>
  );
}
