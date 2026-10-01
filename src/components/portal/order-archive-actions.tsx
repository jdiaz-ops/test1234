"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Archivar / desarchivar / eliminar desde el detalle del pedido. Eliminar
/// solo aparece si el pedido nunca fue una venta real (ver
/// canDeleteStoreOrder); después vuelve a la lista.
export function OrderArchiveActions({
  orderId,
  archived,
  deletable,
}: {
  orderId: string;
  archived: boolean;
  deletable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "archive" | "unarchive" | "delete") {
    if (action === "delete" && !window.confirm("¿Eliminar este pedido? No se puede deshacer.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/marca/tienda/pedidos/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, orderIds: [orderId] }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("No se pudo hacer el cambio.");
      return;
    }
    if (action === "delete") router.push("/marca/tienda/pedidos");
    else router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {archived && (
        <span className="text-[11px] font-medium rounded-md px-2 py-0.5 bg-brand-bg text-brand-ink-soft border border-brand-line">
          Archivado
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => run(archived ? "unarchive" : "archive")}
        className="rounded-full border border-brand-line px-4 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
      >
        {archived ? "Desarchivar" : "Archivar"}
      </button>
      {deletable && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run("delete")}
          className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Eliminar
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
