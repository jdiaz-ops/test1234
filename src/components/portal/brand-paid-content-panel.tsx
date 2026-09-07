"use client";

import { useState } from "react";

export type PaidContentRequestRow = {
  id: string;
  briefing: string;
  feeAmount: number;
  deadlineDays: number | null;
  status: "REQUESTED" | "ACCEPTED" | "DELIVERED" | "DECLINED" | "CANCELLED" | "PAID";
  deliveryUrl: string | null;
  createdAt: string;
  creator: { displayName: string; photoUrl: string | null };
};

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const statusLabel: Record<PaidContentRequestRow["status"], string> = {
  REQUESTED: "Esperando respuesta",
  ACCEPTED: "Aceptado — esperando entrega",
  DELIVERED: "Entregado",
  DECLINED: "Rechazado",
  CANCELLED: "Cancelado",
  PAID: "Pagado",
};

const statusClass: Record<PaidContentRequestRow["status"], string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-brand-accent-soft text-brand-accent",
  DELIVERED: "bg-purple-100 text-purple-700",
  DECLINED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
  PAID: "bg-brand-accent-soft text-brand-accent",
};

export function BrandPaidContentPanel({
  initialRequests,
}: {
  initialRequests: PaidContentRequestRow[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      const res = await fetch("/api/marca/encargos/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)),
        );
      }
    } finally {
      setCancellingId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no has encargado ningún contenido.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-brand-line bg-brand-surface p-4"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-sm font-medium text-brand-ink">
                {r.creator.displayName}
              </p>
              <p className="text-xs text-brand-ink-soft">
                {new Date(r.createdAt).toLocaleDateString("es-CO")}
                {r.deadlineDays ? ` · ${r.deadlineDays} días para entregar` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${statusClass[r.status]}`}>
                {statusLabel[r.status]}
              </span>
              <span className="font-mono text-sm text-brand-ink">{money(r.feeAmount)}</span>
            </div>
          </div>
          <p className="text-sm text-brand-ink-soft mb-2">{r.briefing}</p>
          {r.deliveryUrl && (
            <a
              href={r.deliveryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-accent hover:underline"
            >
              Ver contenido entregado →
            </a>
          )}
          {r.status === "REQUESTED" && (
            <button
              type="button"
              onClick={() => cancel(r.id)}
              disabled={cancellingId === r.id}
              className="text-xs text-red-600 hover:underline mt-2 disabled:opacity-50"
            >
              {cancellingId === r.id ? "Cancelando..." : "Cancelar encargo"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
