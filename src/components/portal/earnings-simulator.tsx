"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/portal/currency-input";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

/// Simulador puramente educativo — no habla de ninguna marca puntual ni de
/// la tarifa de Marcolini, solo del mecanismo: más ventas × mejor comisión
/// = más ingreso. El % de comisión es ajustable porque varía según la
/// marca (se ve al unirse a cada una en el marketplace).
///
/// Inputs directos en vez de sliders (versión anterior): un slider obliga
/// a "adivinar" arrastrando hasta la cifra que uno tiene en mente, en vez
/// de simplemente escribirla — poco práctico para números concretos como
/// "vendo unas 8 al mes". Mismo patrón que el simulador de para-marcas
/// (cost-calculator.tsx): header "SIMULADOR", CurrencyInput reutilizado
/// para el monto.
export function EarningsSimulator() {
  const [ventasRaw, setVentasRaw] = useState("10");
  const [montoRaw, setMontoRaw] = useState("80000");
  const [comisionRaw, setComisionRaw] = useState("12");

  const ventas = Number(ventasRaw) || 0;
  const monto = Number(montoRaw) || 0;
  const comision = Number(comisionRaw) || 0;
  const ganancia = ventas * monto * (comision / 100);

  return (
    <div className="rounded-2xl bg-brand-bg border border-brand-line overflow-hidden max-w-2xl mx-auto">
      <div className="flex items-center gap-2 bg-brand-accent-soft px-4 py-2 border-b border-brand-line">
        <span className="font-mono text-[10px] font-semibold tracking-widest text-brand-accent">SIMULADOR</span>
        <span className="text-xs text-brand-ink">cuánto podrías ganar al mes</span>
      </div>
      <div className="p-6 sm:p-8">
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-brand-ink-soft mb-1">Ventas al mes</label>
            <input
              type="number"
              min={0}
              max={500}
              value={ventasRaw}
              onChange={(e) => setVentasRaw(e.target.value)}
              className="input font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-ink-soft mb-1">Compra promedio</label>
            <CurrencyInput value={montoRaw} onChange={setMontoRaw} placeholder="80.000" />
          </div>
          <div>
            <label className="block text-xs text-brand-ink-soft mb-1">% de comisión</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={comisionRaw}
              onChange={(e) => setComisionRaw(e.target.value)}
              className="input font-mono"
            />
            <p className="text-[11px] text-brand-ink-soft mt-1">Varía según la marca — la ves al unirte a cada una.</p>
          </div>
        </div>

        <div className="rounded-xl bg-brand-accent-soft px-6 py-5 text-center">
          <p className="text-xs text-brand-ink-soft mb-1">Ingreso estimado al mes</p>
          <p className="font-display text-3xl font-semibold text-brand-accent">{formatCOP(ganancia)}</p>
        </div>
      </div>
    </div>
  );
}
