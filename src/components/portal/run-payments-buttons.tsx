"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Botones manuales para correr el cobro del día 1 / pago del día 15 — en
/// producción esto lo dispara a diario /api/cron/pagos-diarios; mientras
/// tanto el admin lo puede correr desde acá para operar y probar.
export function RunPaymentsButtons() {
  const router = useRouter();
  const [loading, setLoading] = useState<"charge" | "payout" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run(action: "charge" | "payout") {
    setLoading(action);
    setResult(null);
    const res = await fetch("/api/admin/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json();
    setLoading(null);
    if (!res.ok) {
      setResult(body.error ?? "No se pudo procesar.");
      return;
    }
    const label = action === "charge" ? "marca(s) cobrada(s)" : "creador(es) pagado(s)";
    setResult(`${body.results.length} ${label}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => run("charge")}
        disabled={loading !== null}
        className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading === "charge" ? "Cobrando..." : "Ejecutar cobro a marcas (día 1)"}
      </button>
      <button
        onClick={() => run("payout")}
        disabled={loading !== null}
        className="bg-brand-ink text-white rounded-full px-5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading === "payout" ? "Pagando..." : "Ejecutar pago a creadores (día 15)"}
      </button>
      {result && <p className="text-xs text-brand-ink-soft">{result}</p>}
    </div>
  );
}
