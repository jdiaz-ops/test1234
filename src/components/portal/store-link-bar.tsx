"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const noSubscribe = () => () => {};

/// El link de la tienda arriba del Dashboard, siempre a la vista y para
/// copiar (pedido del 2026-10-19). Sin link todavía, lleva a elegirlo.
/// Tarjeta grande con el link completo (en el celular ya no se corta) y
/// botones de verdad: copiar, compartir (WhatsApp, Instagram… donde el
/// navegador lo permite) y ver la tienda — pedido del 2026-10-19: "haz
/// esto visualmente más lindo y presente".
export function StoreLinkBar({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);
  // Compartir solo existe en algunos navegadores (casi todos los
  // celulares); en el servidor no se sabe, así que arranca en false.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

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

  async function share() {
    try {
      await navigator.share({ url: url! });
    } catch {
      // La persona cerró el menú de compartir: no pasa nada.
    }
  }

  const shown = url.replace(/^https?:\/\//, "");
  const button = "rounded-full px-3 sm:px-5 py-2.5 text-xs font-medium text-center whitespace-nowrap";
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9.5 5.5 4h13L20 9.5" />
            <path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0" />
            <path d="M5.5 12.5V20h13v-7.5" />
            <path d="M10 20v-4.5h4V20" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs text-brand-ink-soft">Link de tu tienda</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-display text-lg font-semibold leading-snug text-brand-ink [overflow-wrap:anywhere] hover:text-brand-accent sm:text-xl"
          >
            {shown}
          </a>
        </div>
      </div>
      <div className={`grid shrink-0 gap-2 sm:flex ${canShare ? "grid-cols-3" : "grid-cols-2"}`}>
        <button type="button" onClick={copy} className={`${button} bg-brand-accent text-white hover:opacity-90`}>
          {copied ? "¡Copiado!" : "Copiar link"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={share}
            className={`${button} border border-brand-accent/40 bg-brand-surface text-brand-accent hover:border-brand-accent`}
          >
            Compartir
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} border border-brand-line bg-brand-surface text-brand-ink hover:border-brand-ink`}
        >
          Ver tienda<span className="hidden sm:inline"> →</span>
        </a>
      </div>
    </div>
  );
}
