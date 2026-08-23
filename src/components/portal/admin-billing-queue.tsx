"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  brandName: string;
  totalAmount: number;
  dueAt: string;
  proofUrl: string | null;
  proofSubmittedAt: string | null;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function QueueRow({ item }: { item: Item }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/facturacion/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargeId: item.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo verificar.");
      return;
    }
    router.refresh();
  }

  async function reject() {
    if (!reason.trim()) {
      setError("Explica por qué se rechaza");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/facturacion/rechazar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargeId: item.id, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo rechazar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-display font-semibold text-brand-ink">{item.brandName}</p>
          <p className="text-xs text-brand-ink-soft font-mono mt-0.5">
            {formatCOP(item.totalAmount)} — vence{" "}
            {new Date(item.dueAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        {item.proofUrl && (
          <a href={item.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-accent font-medium hover:underline shrink-0">
            Ver comprobante
          </a>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {rejecting ? (
        <div className="space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo del rechazo"
            className="input text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={reject}
              disabled={busy}
              className="text-xs bg-red-600 text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
            >
              Confirmar rechazo
            </button>
            <button onClick={() => setRejecting(false)} className="text-xs text-brand-ink-soft hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={approve}
            disabled={busy}
            className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
          >
            Verificar y reactivar
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminBillingQueue({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-brand-ink-soft">No hay comprobantes esperando verificación.</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <QueueRow key={item.id} item={item} />
      ))}
    </div>
  );
}
