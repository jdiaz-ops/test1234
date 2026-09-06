"use client";

import { useState } from "react";

export type SampleEligibleProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  sampleStock: number;
  sampleContentType: string | null;
  sampleInstructions: string | null;
  sampleDeadlineDays: number | null;
  brand: { companyName: string; logoUrl: string | null };
};

export type CreatorSampleRequestRow = {
  id: string;
  productId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  quantity: number;
  rejectedReason: string | null;
  createdAt: string;
  product: { name: string; imageUrl: string | null };
  brand: { companyName: string };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

const STATUS_LABEL: Record<CreatorSampleRequestRow["status"], string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const STATUS_CLASS: Record<CreatorSampleRequestRow["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-brand-accent-soft text-brand-accent",
  REJECTED: "bg-red-100 text-red-700",
};

function RequestForm({
  product,
  defaultPhone,
  defaultCity,
  onDone,
  onCancel,
}: {
  product: SampleEligibleProduct;
  defaultPhone: string;
  defaultCity: string;
  onDone: (quantity: number) => void;
  onCancel: () => void;
}) {
  const maxQty = Math.min(5, product.sampleStock);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState(defaultPhone);
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState(defaultCity);
  const [shippingNotes, setShippingNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/creador/muestras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          message,
          shippingName,
          shippingPhone,
          shippingAddress,
          shippingCity,
          shippingNotes,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar la solicitud.");
        return;
      }
      onDone(quantity);
    } catch {
      setError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-xl border border-brand-line bg-brand-bg p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Cantidad</label>
          <input
            type="number"
            min={1}
            max={maxQty}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Nombre completo
          </label>
          <input
            required
            value={shippingName}
            onChange={(e) => setShippingName(e.target.value)}
            className="input text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Teléfono</label>
          <input
            required
            value={shippingPhone}
            onChange={(e) => setShippingPhone(e.target.value)}
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">Ciudad</label>
          <input
            required
            value={shippingCity}
            onChange={(e) => setShippingCity(e.target.value)}
            className="input text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-brand-ink mb-1">
          Dirección de envío
        </label>
        <input
          required
          value={shippingAddress}
          onChange={(e) => setShippingAddress(e.target.value)}
          className="input text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-ink mb-1">
          Notas de envío (opcional)
        </label>
        <input
          value={shippingNotes}
          onChange={(e) => setShippingNotes(e.target.value)}
          className="input text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-ink mb-1">
          Mensaje para la marca (opcional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 300))}
          placeholder="Ej. la voy a probar en un video de rutina..."
          className="input text-sm min-h-16"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Enviar solicitud"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-brand-ink-soft hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function CreatorSamplesPanel({
  initialProducts,
  initialRequests,
  defaultPhone,
  defaultCity,
}: {
  initialProducts: SampleEligibleProduct[];
  initialRequests: CreatorSampleRequestRow[];
  defaultPhone: string;
  defaultCity: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [justRequestedIds, setJustRequestedIds] = useState<Set<string>>(
    new Set(),
  );

  const pendingProductIds = new Set([
    ...requests.filter((r) => r.status === "PENDING").map((r) => r.productId),
    ...justRequestedIds,
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-base font-semibold text-brand-ink mb-1">
          Muestras disponibles
        </h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          Productos que las marcas habilitaron para regalar — pídelos gratis y
          muéstralos en tu contenido.
        </p>
        {initialProducts.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">
            Todavía no hay muestras disponibles — vuelve pronto.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {initialProducts.map((p) => {
              const requested = pendingProductIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-brand-line bg-brand-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto del producto
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-14 h-14 rounded-lg object-cover border border-brand-line shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-brand-accent-soft shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-brand-ink-soft truncate">
                        {p.brand.companyName}
                      </p>
                      <p className="text-sm font-medium text-brand-ink truncate">
                        {p.name}
                      </p>
                    </div>
                  </div>

                  {(p.sampleContentType ||
                    p.sampleInstructions ||
                    p.sampleDeadlineDays) && (
                    <div className="mt-3 rounded-lg bg-brand-bg p-2.5 text-xs text-brand-ink-soft space-y-1">
                      {p.sampleContentType && (
                        <p>
                          <span className="text-brand-ink font-medium">
                            Contenido esperado:
                          </span>{" "}
                          {p.sampleContentType}
                        </p>
                      )}
                      {p.sampleDeadlineDays && (
                        <p>
                          <span className="text-brand-ink font-medium">
                            Plazo:
                          </span>{" "}
                          {p.sampleDeadlineDays} días después de recibirla
                        </p>
                      )}
                      {p.sampleInstructions && <p>{p.sampleInstructions}</p>}
                    </div>
                  )}

                  {requested ? (
                    <p className="mt-3 text-xs text-brand-accent">
                      Solicitud enviada — a la espera de la marca.
                    </p>
                  ) : openProductId === p.id ? (
                    <RequestForm
                      product={p}
                      defaultPhone={defaultPhone}
                      defaultCity={defaultCity}
                      onCancel={() => setOpenProductId(null)}
                      onDone={(quantity) => {
                        setOpenProductId(null);
                        setJustRequestedIds((prev) => new Set([...prev, p.id]));
                        setRequests((prev) => [
                          {
                            id: `pending-${p.id}`,
                            productId: p.id,
                            status: "PENDING",
                            quantity,
                            rejectedReason: null,
                            createdAt: new Date().toISOString(),
                            product: { name: p.name, imageUrl: p.imageUrl },
                            brand: { companyName: p.brand.companyName },
                          },
                          ...prev,
                        ]);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenProductId(p.id)}
                      className="mt-3 w-full bg-brand-accent text-white rounded-full px-4 py-2 text-xs font-semibold hover:opacity-90"
                    >
                      Solicitar muestra
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-base font-semibold text-brand-ink mb-1">
          Tus solicitudes
        </h2>
        {requests.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">
            Todavía no has pedido ninguna muestra.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-ink truncate">
                    {r.product.name} × {r.quantity}
                  </p>
                  <p className="text-xs text-brand-ink-soft">
                    {r.brand.companyName} · {formatDate(r.createdAt)}
                    {r.status === "REJECTED" && r.rejectedReason
                      ? ` · ${r.rejectedReason}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 shrink-0 ${STATUS_CLASS[r.status]}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
