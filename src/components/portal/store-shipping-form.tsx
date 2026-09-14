"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Ya no incluye tarifa/umbral únicos — el envío se configura por zonas
/// (ver StoreShippingZonesPanel, ahora obligatorio para productos
/// físicos). Esto solo guarda las notas generales que ve el comprador en
/// el checkout. Ver conversación del 2026-09-14: "tienen que crear zonas
/// de envío obligatorio".
export function StoreShippingForm({
  initial,
}: {
  initial: { shippingNotes: string };
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial.shippingNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/marca/tienda/envios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingNotes: notes }),
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
      <p className="text-sm text-brand-ink-soft">
        El costo de envío lo cobra según las zonas que armes abajo — cada
        región puede tener su propia tarifa. Acá solo van notas generales
        que ve el comprador en el checkout.
      </p>
      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Notas de envío (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          placeholder="Ej. tiempos de despacho, ciudades a las que no llegas..."
          className="input min-h-24"
        />
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
