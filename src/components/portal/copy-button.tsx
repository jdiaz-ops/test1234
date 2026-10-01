"use client";

import { useState } from "react";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // portapapeles no disponible — no rompe la página
    }
  }

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={className ?? "text-xs text-brand-accent font-medium hover:underline shrink-0"}
    >
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
