"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingItem = {
  id: string;
  type: string;
  message: string;
  recipientEmail: string;
  createdAt: string;
};

function PendingRow({ item }: { item: PendingItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "aprobar" | "descartar") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/notificaciones-tipos/pendientes/${item.id}/${action}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo procesar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-accent bg-brand-accent-soft p-4 sm:p-5 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="text-xs text-brand-ink-soft font-mono mb-1">
          {item.type} → {item.recipientEmail}
        </p>
        <p className="text-sm text-brand-ink">{item.message}</p>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => act("aprobar")}
          disabled={busy}
          className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
        >
          Aprobar y enviar
        </button>
        <button
          onClick={() => act("descartar")}
          disabled={busy}
          className="text-xs border border-brand-line rounded-full px-4 py-1.5 font-medium hover:bg-brand-bg disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

export function NotificationPendingQueue({ items }: { items: PendingItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3 mb-10">
      <h2 className="font-display text-base font-semibold text-brand-ink">
        Pendientes de aprobar ({items.length})
      </h2>
      {items.map((item) => (
        <PendingRow key={item.id} item={item} />
      ))}
    </div>
  );
}
