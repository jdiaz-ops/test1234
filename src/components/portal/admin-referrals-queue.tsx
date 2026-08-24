"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  referrerName: string;
  referredName: string;
  amount: number;
  status: "PENDING" | "QUALIFIED" | "PAID";
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

const STATUS_LABEL: Record<Item["status"], string> = {
  PENDING: "Esperando primera venta",
  QUALIFIED: "Calificó — falta pagar",
  PAID: "Pagado",
};

function ReferralRow({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/referidos/marcar-pagado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralId: item.id }),
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
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="text-sm text-brand-ink">
          <span className="font-medium">{item.referrerName}</span> invitó a{" "}
          <span className="font-medium">{item.referredName}</span>
        </p>
        <p className="text-xs text-brand-ink-soft mt-0.5">{STATUS_LABEL[item.status]}</p>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <p className="font-mono text-sm text-brand-ink-soft">{formatCOP(item.amount)}</p>
        {item.status === "QUALIFIED" && (
          <button
            onClick={markPaid}
            disabled={busy}
            className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
          >
            Marcar pagado
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminReferralsQueue({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-brand-ink-soft">Todavía no hay referidos registrados.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ReferralRow key={item.id} item={item} />
      ))}
    </div>
  );
}
