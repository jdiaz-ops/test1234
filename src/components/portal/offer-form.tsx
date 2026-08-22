"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CostCalculator } from "@/components/portal/cost-calculator";

type OfferValues = {
  name: string;
  description: string;
  categoryId: string | null;
  defaultCommissionPercent: number;
  defaultDiscountPercent: number;
  joinMode: "OPEN" | "APPROVAL";
  status?: "ACTIVE" | "PAUSED";
};

export function OfferForm({
  initial,
  offerId,
  onDone,
  platformFeePercent,
  vatPercent,
}: {
  initial?: OfferValues;
  offerId?: string;
  onDone?: () => void;
  platformFeePercent: number;
  vatPercent: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<OfferValues>(
    initial ?? {
      name: "",
      description: "",
      categoryId: null,
      defaultCommissionPercent: 15,
      defaultDiscountPercent: 15,
      joinMode: "OPEN",
      status: "ACTIVE",
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = offerId
      ? await fetch("/api/marca/ofertas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offerId, ...form, status: form.status ?? "ACTIVE" }),
        })
      : await fetch("/api/marca/ofertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo guardar la oferta.");
      return;
    }

    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre de la oferta</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Programa de embajadoras 2026"
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input min-h-16"
        />
      </div>
      <div>
        <p className="text-sm text-brand-ink font-medium mb-2">Los dos números que definen tu oferta</p>
        <div className="grid grid-cols-2 gap-px bg-brand-line rounded-2xl overflow-hidden border border-brand-line mb-4">
          <div className="bg-brand-accent-soft p-4">
            <p className="text-xs text-brand-ink-soft mb-1">Comisión para el creador de contenido</p>
            <p className="font-mono text-2xl font-semibold text-brand-accent">{form.defaultCommissionPercent || 0}%</p>
            <p className="text-xs text-brand-ink-soft mt-1">Lo que tú le pagas al creador de contenido por cada venta.</p>
          </div>
          <div className="bg-brand-surface p-4">
            <p className="text-xs text-brand-ink-soft mb-1">Descuento para compradores en tu página web</p>
            <p className="font-mono text-2xl font-semibold text-brand-ink">{form.defaultDiscountPercent || 0}%</p>
            <p className="text-xs text-brand-ink-soft mt-1">Lo que el código le descuenta al cliente final.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-brand-ink mb-1">% Comisión al creador de contenido</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              value={form.defaultCommissionPercent}
              onChange={(e) => setForm({ ...form, defaultCommissionPercent: Number(e.target.value) })}
              className="input font-mono"
            />
            <p className="text-xs text-brand-ink-soft mt-1">100% es del creador de contenido — se factura aparte de tu tarifa.</p>
          </div>
          <div>
            <label className="block text-sm text-brand-ink mb-1">% Descuento del código</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              required
              value={form.defaultDiscountPercent}
              onChange={(e) => setForm({ ...form, defaultDiscountPercent: Number(e.target.value) })}
              className="input font-mono"
            />
            <p className="text-xs text-brand-ink-soft mt-1">
              El descuento que se aplicaría en la compra en tu página web, para el consumidor final.
            </p>
          </div>
        </div>

        <p className="text-sm text-brand-ink font-medium mb-2">Prueba con un ticket de compra real</p>
        <CostCalculator
          commission={form.defaultCommissionPercent || 0}
          discount={form.defaultDiscountPercent || 0}
          platformFeePercent={platformFeePercent}
          vatPercent={vatPercent}
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Vinculación de creadores</label>
        <select
          value={form.joinMode}
          onChange={(e) => setForm({ ...form, joinMode: e.target.value as "OPEN" | "APPROVAL" })}
          className="input"
        >
          <option value="OPEN">Abierta — cualquier creador se une automáticamente</option>
          <option value="APPROVAL">Con aprobación — tú revisas cada creador antes de aceptarlo</option>
        </select>
        <p className="text-xs text-brand-ink-soft mt-1">
          {form.joinMode === "OPEN"
            ? "Ideal si quieres crecer tu red de embajadores rápido y sin esfuerzo."
            : "Ideal si prefieres mantener control sobre quién representa tu marca."}
        </p>
      </div>

      {offerId && (
        <div>
          <label className="block text-sm text-brand-ink mb-1">Estado</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "PAUSED" })}
            className="input"
          >
            <option value="ACTIVE">Activa</option>
            <option value="PAUSED">Pausada</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : offerId ? "Guardar cambios" : "Crear oferta"}
      </button>
    </form>
  );
}
