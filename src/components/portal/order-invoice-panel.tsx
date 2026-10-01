"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Factura electrónica del pedido (conexión directa con Dataico): número,
/// PDF y CUFE cuando salió; el error y "Reintentar" cuando no. Ver
/// dataico-service.ts.
export function OrderInvoicePanel({
  orderId,
  status,
  number,
  pdfUrl,
  cufe,
  error,
  billing,
}: {
  orderId: string;
  status: "PENDING" | "ISSUED" | "FAILED" | null;
  number: string | null;
  pdfUrl: string | null;
  cufe: string | null;
  error: string | null;
  billing: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/marca/tienda/pedidos/factura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) setMessage(body?.error ?? "No se pudo emitir la factura.");
    router.refresh();
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-brand-ink-soft">A nombre de: {billing}</p>
      {status === "ISSUED" ? (
        <>
          <p className="text-brand-ink">
            <span className="text-[11px] font-medium rounded-md px-1.5 py-0.5 bg-emerald-100 text-emerald-800 mr-2">Emitida</span>
            {number}
          </p>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand-accent hover:underline">
              Ver PDF →
            </a>
          )}
          {cufe && <p className="text-[11px] text-brand-ink-soft font-mono break-all">CUFE {cufe}</p>}
        </>
      ) : status === "PENDING" ? (
        <p className="text-brand-ink-soft">Emitiendo la factura...</p>
      ) : (
        <>
          {status === "FAILED" ? (
            <p className="text-red-700 text-xs">{error ?? "No se pudo emitir."}</p>
          ) : (
            <p className="text-brand-ink-soft text-xs">Todavía no tiene factura.</p>
          )}
          <button
            type="button"
            onClick={issue}
            disabled={busy}
            className="text-xs font-medium text-brand-accent hover:underline disabled:opacity-50"
          >
            {busy ? "Emitiendo..." : status === "FAILED" ? "Reintentar" : "Emitir factura"}
          </button>
        </>
      )}
      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
