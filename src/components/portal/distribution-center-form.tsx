"use client";

import { useState } from "react";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";

/// De dónde despacha la marca — puramente informativo (dirección de
/// referencia interna, no aparece en el checkout) salvo por
/// fulfillmentLeadDays, que sí se le suma al tiempo de entrega que ve el
/// comprador (todavía no se muestra en el checkout, queda listo para
/// cuando se calculen tiempos de entrega estimados). Ver conversación del
/// 2026-09-14, referencia de Tiendanube ("Definir centro de distribución
/// principal").
export function DistributionCenterForm({
  initial,
}: {
  initial: {
    originAddress: string;
    originCity: string;
    originRegion: string;
    fulfillmentLeadDays: string;
  };
}) {
  const [address, setAddress] = useState(initial.originAddress);
  const [city, setCity] = useState(initial.originCity);
  const [region, setRegion] = useState(initial.originRegion);
  const [leadDays, setLeadDays] = useState(initial.fulfillmentLeadDays);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/marca/tienda/centro-distribucion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originAddress: address,
          originCity: city,
          originRegion: region,
          fulfillmentLeadDays: leadDays || "0",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6 space-y-4"
    >
      <div>
        <p className="text-sm font-medium text-brand-ink mb-1">
          Centro de distribución
        </p>
        <p className="text-xs text-brand-ink-soft max-w-lg">
          De dónde despachas tus pedidos y cuánto te toma alistarlos antes
          de entregarlos al transportador.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-brand-ink mb-1">Dirección</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej. Calle 10 # 5-30, Bodega 2"
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">Ciudad</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Departamento
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="input text-sm"
          >
            <option value="">Sin especificar</option>
            {COLOMBIA_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Días para alistar el pedido
          </label>
          <input
            type="number"
            min="0"
            max="60"
            step="1"
            value={leadDays}
            onChange={(e) => setLeadDays(e.target.value)}
            className="input text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {saved && <span className="text-xs text-brand-accent">Guardado ✓</span>}
      </div>
    </form>
  );
}
