"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  creatorName: string;
  amount: number;
  payoutMethod: "BANK" | "BRE_B" | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  paymentHolderName: string | null;
  breBKey: string | null;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function PayoutRow({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/pagos-creadores/marcar-pagado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId: item.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo marcar como pagado.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-display font-semibold text-brand-ink">{item.creatorName}</p>
          <p className="text-xs text-brand-ink-soft font-mono mt-0.5">{formatCOP(item.amount)}</p>
        </div>
      </div>

      {item.payoutMethod === "BRE_B" ? (
        <p className="text-sm text-brand-ink-soft mb-3">
          Bre-B — llave: <span className="font-mono text-brand-ink">{item.breBKey ?? "sin registrar"}</span>
        </p>
      ) : item.payoutMethod === "BANK" ? (
        <p className="text-sm text-brand-ink-soft mb-3">
          {item.bankName} — {item.bankAccountType} <span className="font-mono text-brand-ink">{item.bankAccountNumber}</span> — titular:{" "}
          {item.paymentHolderName}
        </p>
      ) : (
        <p className="text-sm text-red-600 mb-3">Este creador no configuró cómo cobrar todavía.</p>
      )}

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <button
        onClick={markPaid}
        disabled={busy}
        className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
      >
        Marcar pagado
      </button>
    </div>
  );
}

export function AdminCreatorPayoutsQueue({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-brand-ink-soft">No hay pagos pendientes de transferir.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <PayoutRow key={item.id} item={item} />
      ))}
    </div>
  );
}
