"use client";

import { useState } from "react";

export function DiscoverableToggle({
  initialDiscoverable,
}: {
  initialDiscoverable: boolean;
}) {
  const [discoverable, setDiscoverable] = useState(initialDiscoverable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setDiscoverable(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/creador/visibilidad", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoverable: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        setDiscoverable(!next);
        return;
      }
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
      setDiscoverable(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-brand-line bg-brand-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-ink mb-1">
            Modo Descubrible
          </p>
          <p className="text-xs text-brand-ink-soft max-w-md">
            Si está prendido, las marcas te pueden encontrar en su buscador de
            creadores e invitarte directo a su programa, o regalarte una
            muestra. Nunca compartimos tu correo ni teléfono — solo tu nombre,
            foto, ciudad y categoría.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={discoverable}
            disabled={saving}
            onChange={(e) => toggle(e.target.checked)}
            className="sr-only peer"
          />
          <span className="w-11 h-6 rounded-full bg-gray-200 peer-checked:bg-brand-accent relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
