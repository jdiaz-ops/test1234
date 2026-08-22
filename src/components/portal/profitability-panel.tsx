"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { label: string; month: string; income: number; cost: number; hasCostEntry: boolean };

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

export function ProfitabilityPanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const currentMonth = rows[rows.length - 1];
  const [amount, setAmount] = useState(currentMonth?.cost ?? 0);
  const [saving, setSaving] = useState(false);

  async function saveCost() {
    setSaving(true);
    await fetch("/api/admin/costos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: currentMonth.month, amount }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden mb-4">
        <table className="w-full text-sm">
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
              const status = !r.hasCostEntry ? "" : result > 0 ? "🟢" : result === 0 ? "🟡" : "🔴";
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

      <div className="rounded-xl border border-brand-line bg-brand-surface p-4 flex items-center gap-3">
        <label className="text-sm text-brand-ink-soft">Costo de este mes:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="input w-40 font-mono py-1.5"
        />
        <button
          onClick={saveCost}
          disabled={saving}
          className="text-sm text-brand-accent font-medium hover:underline"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
