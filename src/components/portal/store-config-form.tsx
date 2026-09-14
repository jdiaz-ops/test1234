"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreConfigForm({ initialSlug }: { initialSlug: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

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
      setSaved(true);
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
        {/* Único link real que se comparte — un dominio propio (ver
            CustomDomainForm) o este subdominio, nunca marcolini.lat/t/{slug}
            (esa ruta solo existe como redirect hacia acá, ver proxy.ts). Ver
            conversación del 2026-09-14: la página mostraba los dos formatos
            a la vez y confundía. */}
        <div className="flex items-center gap-1 text-sm">
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="input font-mono flex-1"
          />
          <span className="text-brand-ink-soft font-mono">.marcolini.lat</span>
        </div>
        <p className="text-xs text-brand-ink-soft mt-1">
          Solo minúsculas, números y guiones. Es el link que vas a compartir
          para que compren directo.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Guardado.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
