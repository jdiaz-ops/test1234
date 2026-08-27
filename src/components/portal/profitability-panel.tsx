"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  label: string;
  month: string;
  income: number;
  cost: number;
  hasCostEntry: boolean;
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
  // Input de texto, no numérico controlado en 0: con value=0 desde el
  // arranque, en varios teclados de mobile escribir sin antes seleccionar
  // el contenido inserta ANTES del 0 en vez de reemplazarlo ("015000" en
  // vez de "15000"). Arranca vacío — cada entrada es un gasto a SUMAR, no
  // el total del mes, así que no tiene sentido precargarlo con nada.
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCost() {
    const amount = Number(amountInput);
    if (!amount || amount <= 0) return;
    setSaving(true);
    await fetch("/api/admin/costos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: currentMonth.month, amount }),
    });
    setSaving(false);
    setAmountInput("");
    router.refresh();
  }

  return (
    <div>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-x-auto mb-4">
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
                  <td className="px-5 py-3 text-brand-ink capitalize">
                    {r.label}
                  </td>
                  <td className="px-5 py-3 font-mono text-brand-ink">
                    {formatCOP(r.income)}
                  </td>
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

      <div className="rounded-xl border border-brand-line bg-brand-surface p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-brand-ink-soft">
          Agregar gasto de este mes:
        </label>
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
          className="input w-40 font-mono py-1.5"
        />
        <button
          onClick={addCost}
          disabled={saving || !amountInput}
          className="text-sm text-brand-accent font-medium hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {saving ? "Agregando..." : "Agregar"}
        </button>
        {currentMonth?.hasCostEntry && (
          <span className="text-xs text-brand-ink-soft font-mono">
            Acumulado este mes: {formatCOP(currentMonth.cost)}
          </span>
        )}
      </div>
    </div>
  );
}
