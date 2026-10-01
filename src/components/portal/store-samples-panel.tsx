"use client";

import { useState } from "react";

export type SampleCatalogProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  manual: boolean;
  sampleEnabled: boolean;
  sampleStock: number;
  sampleContentType: string | null;
  sampleInstructions: string | null;
  sampleDeadlineDays: number | null;
};

export type SampleRequestRow = {
  id: string;
  status: "PENDING" | "OFFERED" | "APPROVED" | "REJECTED";
  initiatedBy: "CREATOR" | "BRAND";
  quantity: number;
  message: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingNotes: string | null;
  shippingEmail: string | null;
  shippingDocument: string | null;
  shippingRegion: string | null;
  rejectedReason: string | null;
  createdAt: string;
  creator: { displayName: string };
  product: { name: string; imageUrl: string | null };
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

function ProductRow({
  product,
  onSaved,
}: {
  product: SampleCatalogProduct;
  onSaved: (p: SampleCatalogProduct) => void;
}) {
  // Solo se muestran los productos que ya están en muestras; "Quitar"
  // los saca (sampleEnabled=false) y vuelven al buscador.
  const enabled = product.sampleEnabled;
  const [stock, setStock] = useState(String(product.sampleStock));
  const [contentType, setContentType] = useState(
    product.sampleContentType ?? "",
  );
  const [instructions, setInstructions] = useState(
    product.sampleInstructions ?? "",
  );
  const [deadlineDays, setDeadlineDays] = useState(
    product.sampleDeadlineDays != null
      ? String(product.sampleDeadlineDays)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(overrides?: { enabled?: boolean; stock?: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/muestras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          sampleEnabled: overrides?.enabled ?? enabled,
          sampleStock:
            (overrides?.stock ?? stock) === ""
              ? 0
              : (overrides?.stock ?? stock),
          sampleContentType: contentType,
          sampleInstructions: instructions,
          sampleDeadlineDays: deadlineDays === "" ? null : deadlineDays,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      onSaved(body.product);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-line bg-brand-surface p-3">
      <div className="flex items-center gap-3">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del producto
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-12 h-12 rounded-lg object-cover border border-brand-line shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-brand-accent-soft shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-brand-ink truncate">
            {product.name}
          </p>
          <p className="text-xs text-brand-ink-soft font-mono">
            {formatCOP(product.price)} ·{" "}
            {product.manual ? "Mi tienda" : "Sincronizado"}
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs text-brand-ink-soft shrink-0">
          Unidades
          <input
            type="number"
            min="0"
            step="1"
            value={stock}
            disabled={saving}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() => save({ stock })}
            className="input w-20 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => save({ enabled: false })}
          disabled={saving}
          className="text-xs text-brand-ink-soft hover:text-red-700 hover:underline shrink-0 disabled:opacity-50"
        >
          Quitar
        </button>
      </div>

      {(stock === "" || Number(stock) <= 0) && (
        <p className="text-xs text-amber-700 mt-2">
          Pon cuántas unidades regalas — con 0 los creadores no lo ven.
        </p>
      )}

      {enabled && (
        <div className="mt-3 pt-3 border-t border-brand-line grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-brand-ink mb-1">
              Tipo de contenido esperado (opcional)
            </label>
            <input
              value={contentType}
              disabled={saving}
              onChange={(e) => setContentType(e.target.value)}
              onBlur={() => save()}
              placeholder="Ej. Reel de unboxing, review en Stories..."
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-ink mb-1">
              Plazo para publicar, en días (opcional)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={deadlineDays}
              disabled={saving}
              onChange={(e) => setDeadlineDays(e.target.value)}
              onBlur={() => save()}
              placeholder="Ej. 15"
              className="input text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-brand-ink mb-1">
              Instrucciones / mensajes clave (opcional)
            </label>
            <textarea
              value={instructions}
              disabled={saving}
              onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
              onBlur={() => save()}
              placeholder="Ej. menciona el ingrediente activo, usa #MarcaNatural, muestra el empaque..."
              className="input text-sm min-h-16"
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function RequestCard({
  request,
  onResolved,
}: {
  request: SampleRequestRow;
  onResolved: (r: SampleRequestRow) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function respond(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/marca/tienda/muestras/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rejectedReason: decision === "REJECTED" ? reason : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo procesar la solicitud.");
        return;
      }
      onResolved({ ...request, ...body.request });
    } catch {
      setError("No se pudo procesar — revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-line bg-brand-surface p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-ink">
            {request.creator.displayName}
          </p>
          <p className="text-xs text-brand-ink-soft">
            {request.product.name} × {request.quantity} ·{" "}
            {formatDate(request.createdAt)}
          </p>
        </div>
        {request.status !== "PENDING" && (
          <span
            className={`text-xs font-medium rounded-full px-2.5 py-1 shrink-0 ${
              request.status === "APPROVED"
                ? "bg-brand-accent-soft text-brand-accent"
                : request.status === "OFFERED"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {request.status === "APPROVED"
              ? "Aprobada"
              : request.status === "OFFERED"
                ? "Ofrecida — esperando respuesta"
                : "Rechazada"}
          </span>
        )}
      </div>

      {request.initiatedBy === "BRAND" && request.status === "OFFERED" && (
        <p className="text-xs text-brand-ink-soft">
          Se la ofreciste tú — todavía no ha respondido.
        </p>
      )}

      {request.message && (
        <p className="text-xs text-brand-ink-soft italic">
          &ldquo;{request.message}&rdquo;
        </p>
      )}

      {request.shippingName && (
        <div className="text-xs text-brand-ink-soft">
          <p>
            {request.shippingName}
            {request.shippingDocument && ` · CC ${request.shippingDocument}`}
          </p>
          <p>
            {request.shippingPhone}
            {request.shippingEmail && ` · ${request.shippingEmail}`}
          </p>
          <p>
            {request.shippingAddress}, {request.shippingCity}
            {request.shippingRegion && `, ${request.shippingRegion}`}
          </p>
          {request.shippingNotes && <p>{request.shippingNotes}</p>}
        </div>
      )}

      {request.status === "REJECTED" && request.rejectedReason && (
        <p className="text-xs text-brand-ink-soft">
          Motivo: {request.rejectedReason}
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {request.status === "PENDING" && !rejecting && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => respond("APPROVED")}
            disabled={busy}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="border border-brand-line rounded-full px-4 py-1.5 text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}

      {request.status === "PENDING" && rejecting && (
        <div className="pt-1 space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="input text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => respond("REJECTED")}
              disabled={busy}
              className="bg-red-600 text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Confirmar rechazo
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              disabled={busy}
              className="text-xs text-brand-ink-soft hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/// Buscador para sumar productos a muestras — antes se listaba todo el
/// catálogo con una casilla por producto, y con catálogos grandes era
/// difícil de leer (pedido de la marca el 2026-10-01).
function AddProductSearch({
  products,
  onAdded,
}: {
  products: SampleCatalogProduct[];
  onAdded: (p: SampleCatalogProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = normalize(query.trim());
  const matches = q
    ? products.filter((p) => normalize(p.name).includes(q)).slice(0, 8)
    : [];

  async function add(product: SampleCatalogProduct) {
    setAddingId(product.id);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/muestras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          sampleEnabled: true,
          sampleStock: product.sampleStock,
          sampleContentType: product.sampleContentType ?? "",
          sampleInstructions: product.sampleInstructions ?? "",
          sampleDeadlineDays: product.sampleDeadlineDays,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo agregar.");
        return;
      }
      onAdded(body.product);
      setQuery("");
    } catch {
      setError("No se pudo agregar — revisa tu conexión.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="mb-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca un producto para agregarlo a muestras…"
        className="input text-sm"
      />
      {q && (
        <div className="mt-2 rounded-xl border border-brand-line bg-brand-surface divide-y divide-brand-line">
          {matches.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-brand-ink-soft">
              Ningún producto coincide con &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            matches.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto del producto
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-9 h-9 rounded-lg object-cover border border-brand-line shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-brand-accent-soft shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-ink truncate">{p.name}</p>
                  <p className="text-xs text-brand-ink-soft font-mono">
                    {formatCOP(p.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={addingId !== null}
                  className="bg-brand-accent text-white rounded-full px-3 py-1 text-xs font-semibold hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {addingId === p.id ? "Agregando…" : "+ Agregar"}
                </button>
              </div>
            ))
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export function StoreSamplesPanel({
  initialProducts,
  initialRequests,
}: {
  initialProducts: SampleCatalogProduct[];
  initialRequests: SampleRequestRow[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [requests, setRequests] = useState(initialRequests);

  const pending = requests.filter((r) => r.status === "PENDING");
  const inSamples = products.filter((p) => p.sampleEnabled);
  const available = products.filter((p) => !p.sampleEnabled);
  const replaceProduct = (updated: SampleCatalogProduct) =>
    setProducts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-base font-semibold text-brand-ink mb-1">
          Solicitudes de muestra
        </h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          Creadores que pidieron una muestra de tu catálogo.
        </p>
        {requests.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">
            Todavía no hay solicitudes.
          </p>
        ) : (
          <div className="space-y-3">
            {[...pending, ...resolved].map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onResolved={(updated) =>
                  setRequests((prev) =>
                    prev.map((x) => (x.id === updated.id ? updated : x)),
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-brand-ink mb-1">
          Productos para muestras
        </h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          Agrega los productos que quieres regalar y cuántas unidades tienes —
          solo los ven los creadores, nunca tu tienda pública.
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">
            Todavía no tienes productos en tu catálogo.
          </p>
        ) : (
          <>
            <AddProductSearch products={available} onAdded={replaceProduct} />
            {inSamples.length === 0 ? (
              <p className="text-sm text-brand-ink-soft">
                Todavía no has agregado productos. Búscalos arriba.
              </p>
            ) : (
              <div className="space-y-2">
                {inSamples.map((p) => (
                  <ProductRow key={p.id} product={p} onSaved={replaceProduct} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
