"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CodeOption = { discountCode: string; creatorName: string; offerName: string };

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function ManualSaleForm({ codeOptions }: { codeOptions: CodeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    discountCode: codeOptions[0]?.discountCode ?? "",
    grossAmount: "",
    occurredAt: todayInput(),
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/marca/ventas-manuales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, grossAmount: Number(form.grossAmount) }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo registrar la venta.");
      return;
    }

    setForm({ discountCode: codeOptions[0]?.discountCode ?? "", grossAmount: "", occurredAt: todayInput(), note: "" });
    setOpen(false);
    router.refresh();
  }

  if (codeOptions.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft mb-6"
      >
        + Registrar venta manual
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-accent bg-brand-accent-soft p-5 mb-6 max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold text-brand-ink">Registrar venta manual</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-ink-soft hover:text-brand-ink">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-brand-ink-soft">
        Para una venta que pasó por fuera de tu tienda conectada (ej. un pedido por WhatsApp) — se calcula y paga
        la comisión exactamente igual que una venta automática.
      </p>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Código usado</label>
        <select
          required
          value={form.discountCode}
          onChange={(e) => setForm({ ...form, discountCode: e.target.value })}
          className="input"
        >
          {codeOptions.map((c) => (
            <option key={c.discountCode} value={c.discountCode}>
              {c.creatorName} — {c.discountCode} ({c.offerName})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Precio de lista (antes del descuento)</label>
        <input
          required
          type="number"
          min="1"
          step="1"
          value={form.grossAmount}
          onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
          placeholder="150000"
          className="input font-mono"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Fecha de la venta</label>
        <input
          required
          type="date"
          max={todayInput()}
          value={form.occurredAt}
          onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
          className="input"
        />
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Referencia (opcional)</label>
        <input
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="ej. Pedido de Instagram #4521"
          className="input"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Registrando..." : "Registrar venta"}
      </button>
    </form>
  );
}
