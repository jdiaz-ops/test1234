"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseShopifyCustomersCsv, type ImportCustomer, type CustomersCsvStats } from "@/lib/shopify-customers-csv";

const BATCH_SIZE = 500;

function n(value: number) {
  return value.toLocaleString("es-CO");
}

/// Mi tienda → Clientes → "Importar desde Shopify". El CSV se lee en el
/// navegador (lib/shopify-customers-csv.ts) y se manda por lotes a
/// /api/marca/tienda/clientes/importar. Se puede repetir con el mismo
/// archivo sin duplicar a nadie (2026-10-04).
export function ShopifyCustomersImporter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [customers, setCustomers] = useState<ImportCustomer[]>([]);
  const [stats, setStats] = useState<CustomersCsvStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "importing" | "done">("pick");
  const [done, setDone] = useState(0);
  const [result, setResult] = useState({ created: 0, updated: 0, skipped: 0, failedBatches: 0 });

  async function handleFile(file: File | null) {
    setStats(null);
    setCustomers([]);
    setError(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      const parsed = parseShopifyCustomersCsv(await file.text());
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      setCustomers(parsed.customers);
      setStats(parsed.stats);
    } catch {
      setError("No se pudo leer el archivo. Revisa que sea el CSV de clientes exportado desde Shopify.");
    }
  }

  async function runImport() {
    setPhase("importing");
    setDone(0);
    const total = { created: 0, updated: 0, skipped: 0, failedBatches: 0 };
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/marca/tienda/clientes/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customers: batch }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          total.failedBatches++;
        } else {
          total.created += body.created;
          total.updated += body.updated;
          total.skipped += body.skipped;
        }
      } catch {
        total.failedBatches++;
      }
      setDone(Math.min(i + BATCH_SIZE, customers.length));
    }
    setResult(total);
    setPhase("done");
    router.refresh();
  }

  function reset() {
    setOpen(false);
    setPhase("pick");
    setStats(null);
    setCustomers([]);
    setFileName(null);
    setError(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-brand-line rounded-full px-4 py-2 text-sm text-brand-ink hover:bg-brand-accent-soft"
      >
        Importar desde Shopify
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-ink">Importar clientes desde Shopify</p>
        {phase !== "importing" && (
          <button type="button" onClick={reset} className="text-xs text-brand-ink-soft hover:underline">
            Cerrar
          </button>
        )}
      </div>

      {phase === "pick" && (
        <>
          <p className="text-xs text-brand-ink-soft">
            En Shopify ve a <strong>Clientes → Exportar</strong>, elige <strong>Todos los clientes</strong> y{" "}
            <strong>CSV para Excel o similar</strong>. Sube aquí ese archivo. Puedes repetirlo cuando quieras: no se
            duplica nadie.
          </p>
          <label className="block rounded-xl border border-dashed border-brand-line px-4 py-6 text-center text-sm text-brand-ink-soft cursor-pointer hover:bg-brand-accent-soft">
            {fileName ? <span className="text-brand-ink">{fileName}</span> : "Elige el archivo .csv"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}

          {stats && (
            <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-1.5 text-sm">
              <p className="font-medium text-brand-ink">{n(stats.withEmail)} clientes listos para importar</p>
              <p className="text-xs text-brand-ink-soft">
                {n(stats.withOrders)} ya te han comprado · {n(stats.withoutOrders)} sin compras (registros o
                newsletter)
              </p>
              <p className="text-xs text-brand-ink-soft">
                {n(stats.emailSubscribed)} suscritos a correos · {n(stats.smsSubscribed)} suscritos a SMS o WhatsApp
              </p>
              {stats.withoutEmail > 0 && (
                <p className="text-xs text-amber-700">
                  {n(stats.withoutEmail)} no tienen correo y no se importan: en Marcolini cada cliente se identifica
                  por su correo.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={runImport}
            disabled={customers.length === 0}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            Importar {customers.length > 0 ? n(customers.length) : ""} clientes
          </button>
        </>
      )}

      {phase === "importing" && (
        <div className="space-y-2">
          <p className="text-sm text-brand-ink">
            Importando… {n(done)} de {n(customers.length)}
          </p>
          <div className="h-2 rounded-full bg-brand-bg overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all"
              style={{ width: `${customers.length ? (done / customers.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-brand-ink-soft">No cierres esta página hasta que termine.</p>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-2 text-sm">
          <p className="text-brand-ink">
            Listo: {n(result.created)} clientes nuevos y {n(result.updated)} actualizados.
          </p>
          {result.skipped > 0 && (
            <p className="text-xs text-amber-700">{n(result.skipped)} filas con datos inválidos se saltaron.</p>
          )}
          {result.failedBatches > 0 && (
            <p className="text-xs text-red-600">
              {n(result.failedBatches)} {result.failedBatches === 1 ? "lote no se pudo" : "lotes no se pudieron"}{" "}
              guardar. Vuelve a importar el mismo archivo: lo que ya entró no se duplica.
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
          >
            Ver clientes
          </button>
        </div>
      )}
    </div>
  );
}
