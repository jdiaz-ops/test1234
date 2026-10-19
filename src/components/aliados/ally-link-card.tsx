"use client";

import { useState } from "react";

/// El link propio del aliado, para copiarlo o mandarlo por WhatsApp.
export function AllyLinkCard({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  const message = encodeURIComponent(`Te invito a vender con Marcolini. Déjame tus datos acá y el equipo te contacta: ${link}`);
  return (
    <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-brand-ink">Tu link</h2>
        <p className="text-xs text-brand-ink-soft">
          Compártelo con marcas y creadoras. Ahí eligen «Soy marca» o «Soy creadora», dejan sus datos y Marcolini las contacta.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input readOnly value={link} className="input flex-1 font-mono text-sm" aria-label="Tu link" onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy} className="rounded-full bg-brand-ink text-white px-5 py-2 text-sm font-medium hover:opacity-90">
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
        <a
          href={`https://wa.me/?text=${message}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-brand-line px-5 py-2 text-sm font-medium text-brand-ink text-center hover:bg-brand-accent-soft"
        >
          Mandar por WhatsApp
        </a>
      </div>
    </section>
  );
}
