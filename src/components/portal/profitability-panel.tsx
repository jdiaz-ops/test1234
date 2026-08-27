"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CostEntry = { id: string; label: string; amount: number };

type Row = {
  label: string;
  month: string;
  income: number;
  cost: number;
  hasCostEntry: boolean;
  costEntries: CostEntry[];
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProfitabilityPanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const currentMonth = rows[rows.length - 1];
  const [labelInput, setLabelInput] = useState("");
  // Input de texto, no numérico controlado en 0: con value=0 desde el
  // arranque, en varios teclados de mobile escribir sin antes seleccionar
  // el contenido inserta ANTES del 0 en vez de reemplazarlo ("015000" en
  // vez de "15000"). Arranca vacío — cada entrada es un gasto puntual que
  // se SUMA a los demás del mes, no el total, así que no tiene sentido
  // precargarlo con nada.
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addCost() {
    const amount = Number(amountInput);
    if (!labelInput.trim() || !amount || amount <= 0) return;
    setSaving(true);
    await fetch("/api/admin/costos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: currentMonth.month, label: labelInput.trim(), amount }),
    });
    setSaving(false);
    setLabelInput("");
    setAmountInput("");
    router.refresh();
  }

  async function removeCost(id: string) {
    setDeletingId(id);
    await fetch("/api/admin/costos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Mes</th>
                <th className="px-5 py-3 font-normal">Ingreso (tarifa)</th>
                <th className="px-5 py-3 font-normal">Costo</th>
                <th className="px-5 py-3 font-normal">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {rows.map((r) => {
                const result = r.income - r.cost;
                const status = !r.hasCostEntry
                  ? ""
                  : result > 0
                    ? "🟢"
                    : result === 0
                      ? "🟡"
                      : "🔴";
                return (
                  <tr key={r.month}>
                    <td className="px-5 py-3 text-brand-ink capitalize">{r.label}</td>
                    <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(r.income)}</td>
                    <td className="px-5 py-3 font-mono text-brand-ink-soft">
                      {r.hasCostEntry ? formatCOP(r.cost) : "— sin registrar"}
                    </td>
                    <td className="px-5 py-3 font-mono">
                      {status} {r.hasCostEntry ? formatCOP(result) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-brand-line bg-brand-surface p-4 mb-4">
        <p className="text-sm text-brand-ink-soft mb-3">Agregar gasto de este mes:</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Ej. Compra del dominio"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            className="input flex-1 min-w-[180px] py-1.5"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amountInput}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              // Solo dígitos — texto libre (no type=number) para controlar
              // nosotros el valor y evitar el bug del 0 fantasma delante.
              const digits = e.target.value.replace(/[^0-9]/g, "");
              setAmountInput(digits);
            }}
            className="input w-32 font-mono py-1.5"
          />
          <button
            onClick={addCost}
            disabled={saving || !amountInput || !labelInput.trim()}
            className="text-sm text-brand-accent font-medium hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {saving ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </div>

      {/* Detalle de gastos del mes actual — para poder identificar "en qué
          se fue la plata" (dominio, servidor, herramientas...), no solo
          ver el total acumulado. */}
      {currentMonth?.costEntries && currentMonth.costEntries.length > 0 && (
        <div className="rounded-xl border border-brand-line bg-brand-surface overflow-hidden">
          <p className="px-4 pt-4 text-xs text-brand-ink-soft">
            Gastos de {currentMonth.label} · Acumulado: {formatCOP(currentMonth.cost)}
          </p>
          <ul className="divide-y divide-brand-line mt-3">
            {currentMonth.costEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-brand-ink">{entry.label}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm text-brand-ink-soft">{formatCOP(entry.amount)}</span>
                  <button
                    onClick={() => removeCost(entry.id)}
                    disabled={deletingId === entry.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
