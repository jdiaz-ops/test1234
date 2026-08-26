"use client";

import { useState } from "react";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

/// Simulador puramente educativo — no habla de ninguna marca puntual ni de
/// la tarifa de Marcolini, solo del mecanismo: más ventas × mejor comisión
/// = más ingreso. El % de comisión es ajustable porque varía según la
/// marca (se ve al unirse a cada una en el marketplace).
export function EarningsSimulator() {
  const [ventas, setVentas] = useState(10);
  const [monto, setMonto] = useState(80000);
  const [comision, setComision] = useState(12);

  const ganancia = ventas * monto * (comision / 100);

  return (
    <div className="rounded-2xl bg-brand-surface border border-brand-line p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="grid sm:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Ventas al mes <span className="font-mono text-brand-accent">{ventas}</span>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={ventas}
            onChange={(e) => setVentas(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--brand-accent)" }}
          />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            Compra promedio <span className="font-mono text-brand-accent">{formatCOP(monto)}</span>
          </label>
          <input
            type="range"
            min={20000}
            max={300000}
            step={5000}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--brand-accent)" }}
          />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">
            % de comisión <span className="font-mono text-brand-accent">{comision}%</span>
          </label>
          <input
            type="range"
            min={5}
            max={25}
            value={comision}
            onChange={(e) => setComision(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--brand-accent)" }}
          />
          <p className="text-xs text-brand-ink-soft mt-1">Varía según la marca — la ves al unirte a cada una.</p>
        </div>
      </div>

      <div className="rounded-xl bg-brand-accent-soft px-6 py-5 text-center">
        <p className="text-xs text-brand-ink-soft mb-1">Ingreso estimado al mes</p>
        <p className="font-display text-3xl font-semibold text-brand-accent">{formatCOP(ganancia)}</p>
      </div>
    </div>
  );
}
