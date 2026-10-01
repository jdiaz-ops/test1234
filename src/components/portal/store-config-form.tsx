"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROOT_DOMAIN } from "@/lib/subdomain";

/// El link de la tienda ({slug}.marcolini.lat). Se elige UNA vez: después
/// queda fijo, porque lo comparten la marca, sus creadores y los
/// publishers, y cambiarlo rompía todos esos links. Si de verdad hace
/// falta, lo cambia Marcolini (Admin → Marcas) y el viejo sigue llevando
/// al nuevo. Ver saveStorefrontSlug y conversación del 2026-10-01.
export function StoreConfigForm({ initialSlug }: { initialSlug: string }) {
  if (initialSlug) return <LockedStoreLink slug={initialSlug} />;
  return <ChooseStoreLink />;
}

function LockedStoreLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://${slug}.${ROOT_DOMAIN}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia el link:", url);
    }
  }

  return (
    <div className="max-w-lg">
      <p className="block text-sm text-brand-ink mb-1">Link de tu tienda</p>
      <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-surface px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-ink-soft shrink-0" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span className="font-mono text-sm text-brand-ink truncate flex-1">
          {slug}
          <span className="text-brand-ink-soft">.{ROOT_DOMAIN}</span>
        </span>
        <button
          type="button"
          onClick={copy}
          className="text-xs font-medium text-brand-accent hover:underline shrink-0"
        >
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
      <p className="text-xs text-brand-ink-soft mt-1.5">
        Este link quedó fijo para que no se rompan los links que ya
        compartiste tú y tus creadores. Si necesitas cambiarlo, escríbenos.
      </p>
    </div>
  );
}

function ChooseStoreLink() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        `Tu tienda va a quedar en ${slug}.${ROOT_DOMAIN} y no lo vas a poder cambiar después. ¿Continuar?`,
      )
    )
      return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/marca/tienda/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontSlug: slug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo guardar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Link de tu tienda
        </label>
        <div className="flex items-center gap-1 text-sm">
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="tumarca"
            className="input font-mono flex-1"
          />
          <span className="text-brand-ink-soft font-mono">.{ROOT_DOMAIN}</span>
        </div>
        <p className="text-xs text-brand-ink-soft mt-1">
          Solo minúsculas, números y guiones. Es el link que vas a compartir
          para que compren directo. Elígelo bien: después de guardarlo no se
          puede cambiar.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || slug.length < 2}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar link"}
      </button>
    </form>
  );
}
