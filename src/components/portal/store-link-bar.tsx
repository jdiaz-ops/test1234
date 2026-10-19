"use client";

import { useState } from "react";
import Link from "next/link";

/// El link de la tienda arriba del Dashboard, siempre a la vista y para
/// copiar (pedido del 2026-10-19). Sin link todavía, lleva a elegirlo.
export function StoreLinkBar({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return (
      <Link href="/marca/tienda/configuracion" className="inline-block text-sm text-brand-accent hover:underline mb-6">
        Elige el link de tu tienda →
      </Link>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia el link:", url!);
    }
  }

  const shown = url.replace(/^https?:\/\//, "");
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-brand-line bg-brand-surface px-4 py-3 max-w-2xl">
      <span className="text-xs text-brand-ink-soft shrink-0">Link de tu tienda</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-brand-ink truncate min-w-0 flex-1 hover:underline">
        {shown}
      </a>
      <div className="flex items-center gap-4 shrink-0 text-xs font-medium">
        <button type="button" onClick={copy} className="text-brand-accent hover:underline">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
          Ver en vivo →
        </a>
      </div>
    </div>
  );
}
