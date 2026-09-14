"use client";

import { useState } from "react";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/// Calculadora de envío embebida en la ficha de producto (y en el
/// carrito) — reusa el mismo endpoint de cotización en vivo que el
/// checkout (ver quoteShipping en store-order-service.ts). Solo cotiza
/// este producto solo, a la cantidad 1 — una aproximación razonable
/// antes de armar el carrito completo. Ver conversación del 2026-09-14.
export function ProductShippingCalculator({
  brandSlug,
  priceCents,
  weightKg,
}: {
  brandSlug: string;
  priceCents: number;
  weightKg: number;
}) {
  const [region, setRegion] = useState("");
  const [result, setResult] = useState<{ cents: number } | { error: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCalculate() {
    if (!region) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/tienda/${brandSlug}/envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, orderAmountCents: priceCents, weightKg }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.ok) {
        setResult({ cents: body.shippingCents });
      } else {
        setResult({ error: body?.error ?? "No se pudo cotizar el envío." });
      }
    } catch {
      setResult({ error: "No se pudo cotizar — revisa tu conexión." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-line p-3 space-y-2">
      <p className="text-xs font-medium text-brand-ink">Calcular costo de envío</p>
      <div className="flex gap-2">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="input text-sm flex-1">
          <option value="" disabled>
            Tu departamento
          </option>
          {COLOMBIA_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!region || loading}
          className="rounded-full border border-brand-line px-4 text-sm font-medium hover:bg-brand-accent-soft disabled:opacity-50 shrink-0"
        >
          {loading ? "..." : "Calcular"}
        </button>
      </div>
      {result && "cents" in result && (
        <p className="text-sm text-brand-ink">
          Envío a {region}: <span className="font-mono font-medium">{result.cents === 0 ? "Gratis" : formatCOP(result.cents / 100)}</span>
        </p>
      )}
      {result && "error" in result && <p className="text-xs text-red-600">{result.error}</p>}
    </div>
  );
}
