"use client";

import { useState } from "react";

/// Solo Colombia por ahora — se deja como selector (en vez de texto fijo)
/// para no tener que rehacer la UI el día que se agregue otro país. Ver
/// conversación del 2026-09-14: "que puedan configurar el mercado
/// (colombia por defecto)".
const MARKETS: { value: string; label: string }[] = [
  { value: "CO", label: "Colombia" },
];

export function TaxConfigForm({
  initialMarket,
  initialTaxRatePercent,
}: {
  initialMarket: string;
  initialTaxRatePercent: number;
}) {
  const [market, setMarket] = useState(initialMarket);
  const [taxRatePercent, setTaxRatePercent] = useState(
    String(initialTaxRatePercent),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/marca/tienda/impuestos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, taxRatePercent }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
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
          Mercado e impuestos
        </p>
        <p className="text-xs text-brand-ink-soft max-w-lg">
          El IVA se calcula automático en cada pedido del checkout nativo y
          se le muestra al comprador antes de pagar.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Mercado</label>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="input text-sm"
          >
            {MARKETS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">IVA (%)</label>
          <input
            required
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(e.target.value)}
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
