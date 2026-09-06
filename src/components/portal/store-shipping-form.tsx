"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreShippingForm({
  initial,
}: {
  initial: {
    shippingFlatRate: string;
    freeShippingThreshold: string;
    shippingNotes: string;
  };
}) {
  const router = useRouter();
  const [flatRate, setFlatRate] = useState(initial.shippingFlatRate);
  const [freeThreshold, setFreeThreshold] = useState(
    initial.freeShippingThreshold,
  );
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
        body: JSON.stringify({
          shippingFlatRate: flatRate || null,
          freeShippingThreshold: freeThreshold || null,
          shippingNotes: notes,
        }),
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
        Tarifa única por ahora — sin zonas por ciudad todavía. Tú te encargas
        del despacho del pedido, Marcolini solo muestra esta info en el
        checkout.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Costo de envío
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={flatRate}
            onChange={(e) => setFlatRate(e.target.value)}
            placeholder="0"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Envío gratis desde
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={freeThreshold}
            onChange={(e) => setFreeThreshold(e.target.value)}
            placeholder="Sin mínimo"
            className="input"
          />
        </div>
      </div>
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
