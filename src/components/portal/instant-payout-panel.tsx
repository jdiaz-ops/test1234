"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

export function InstantPayoutPanel({
  amountAvailable,
  feePercent,
  feeAmount,
  netAmount,
  hasBankInfo,
}: {
  amountAvailable: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
  hasBankInfo: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (amountAvailable === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no tienes comisiones aprobadas disponibles para un pago anticipado.
      </p>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/creador/pago-anticipado", { method: "POST" });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo procesar el pago anticipado.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-brand-bg border border-brand-line p-4 text-sm space-y-2">
      <div className="flex justify-between font-mono text-xs text-brand-ink-soft">
        <span>Disponible</span>
        <span>{formatCOP(amountAvailable)}</span>
      </div>
      <div className="flex justify-between font-mono text-xs text-brand-ink-soft">
        <span>Fee por adelanto ({feePercent}%)</span>
        <span>-{formatCOP(feeAmount)}</span>
      </div>
      <div className="flex justify-between font-mono text-brand-ink font-semibold pt-2 border-t border-brand-line">
        <span>Recibirías hoy</span>
        <span>{formatCOP(netAmount)}</span>
      </div>

      {!hasBankInfo && (
        <p className="text-xs text-red-600">Registra tu cuenta bancaria arriba antes de pedir el adelanto.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-brand-accent">Pago anticipado procesado.</p>}

      <button
        onClick={handleClick}
        disabled={loading || !hasBankInfo || done}
        className="w-full bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50 mt-1"
      >
        {loading ? "Procesando..." : "Pedir pago anticipado"}
      </button>
    </div>
  );
}
