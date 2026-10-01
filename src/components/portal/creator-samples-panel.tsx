"use client";

import { useState } from "react";
import {
  SampleShippingFields,
  type SampleShipping,
} from "@/components/portal/sample-shipping-fields";

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
  // "OFFERED" nunca aparece acá en la práctica (esta lista solo trae las
  // que el creador mismo pidió) — se incluye en el tipo porque viene del
  // mismo enum de Prisma que SampleOfferRow.
  status: "PENDING" | "OFFERED" | "APPROVED" | "REJECTED";
  quantity: number;
  rejectedReason: string | null;
  createdAt: string;
  product: { name: string; imageUrl: string | null };
  brand: { companyName: string };
};

/// Ofertas que una marca le mandó al creador (push, encontrado en su
/// buscador) — todavía sin resolver, así que siempre están en OFFERED.
export type SampleOfferRow = {
  id: string;
  quantity: number;
  message: string | null;
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
  OFFERED: "Ofrecida",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const STATUS_CLASS: Record<CreatorSampleRequestRow["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  OFFERED: "bg-purple-100 text-purple-700",
  APPROVED: "bg-brand-accent-soft text-brand-accent",
  REJECTED: "bg-red-100 text-red-700",
};

function RequestForm({
  product,
  defaultShipping,
  onDone,
  onCancel,
}: {
  product: SampleEligibleProduct;
  defaultShipping: SampleShipping;
  onDone: (quantity: number, shipping: SampleShipping) => void;
  onCancel: () => void;
}) {
  const maxQty = Math.min(5, product.sampleStock);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [shipping, setShipping] = useState(defaultShipping);
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
        body: JSON.stringify({ productId: product.id, quantity, message, ...shipping }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar la solicitud.");
        return;
      }
      onDone(quantity, shipping);
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
      <div className="w-28">
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
      <SampleShippingFields value={shipping} onChange={setShipping} />
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

function AcceptOfferForm({
  offer,
  defaultShipping,
  onDone,
  onCancel,
}: {
  offer: SampleOfferRow;
  defaultShipping: SampleShipping;
  onDone: (shipping: SampleShipping) => void;
  onCancel: () => void;
}) {
  const [shipping, setShipping] = useState(defaultShipping);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/creador/muestras/ofertas/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accept", ...shipping }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo aceptar.");
        return;
      }
      onDone(shipping);
    } catch {
      setError("No se pudo aceptar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-xl border border-brand-line bg-brand-bg p-4"
    >
      <SampleShippingFields value={shipping} onChange={setShipping} />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Aceptar y confirmar"}
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

function OfferCard({
  offer,
  defaultShipping,
  onResolved,
  onShippingSaved,
}: {
  offer: SampleOfferRow;
  defaultShipping: SampleShipping;
  onResolved: (offerId: string) => void;
  onShippingSaved: (shipping: SampleShipping) => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decline() {
    setDeclining(true);
    setError(null);
    try {
      const res = await fetch(`/api/creador/muestras/ofertas/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "decline" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo rechazar.");
        return;
      }
      onResolved(offer.id);
    } catch {
      setError("No se pudo rechazar — revisa tu conexión.");
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4">
      <div className="flex items-center gap-3">
        {offer.product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del producto
          <img
            src={offer.product.imageUrl}
            alt={offer.product.name}
            className="w-14 h-14 rounded-lg object-cover border border-brand-line shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-brand-accent-soft shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-brand-ink-soft truncate">
            {offer.brand.companyName} te quiere regalar
          </p>
          <p className="text-sm font-medium text-brand-ink truncate">
            {offer.product.name} × {offer.quantity}
          </p>
        </div>
      </div>

      {offer.message && (
        <p className="mt-3 text-xs text-brand-ink-soft italic">
          &ldquo;{offer.message}&rdquo;
        </p>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {accepting ? (
        <AcceptOfferForm
          offer={offer}
          defaultShipping={defaultShipping}
          onCancel={() => setAccepting(false)}
          onDone={(shipping) => {
            onShippingSaved(shipping);
            onResolved(offer.id);
          }}
        />
      ) : (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setAccepting(true)}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={decline}
            disabled={declining}
            className="border border-brand-line rounded-full px-4 py-1.5 text-xs font-medium hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-50"
          >
            {declining ? "..." : "Rechazar"}
          </button>
        </div>
      )}
    </div>
  );
}

export function CreatorSamplesPanel({
  initialProducts,
  initialRequests,
  initialOffers,
  defaultShipping,
}: {
  initialProducts: SampleEligibleProduct[];
  initialRequests: CreatorSampleRequestRow[];
  initialOffers: SampleOfferRow[];
  /// Su última dirección usada, o lo que ya se sabe de su perfil.
  defaultShipping: SampleShipping;
}) {
  const [offers, setOffers] = useState(initialOffers);
  // La dirección usada en una solicitud queda para la siguiente, sin
  // recargar la página.
  const [shipping, setShipping] = useState(defaultShipping);
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
      {offers.length > 0 && (
        <div>
          <h2 className="font-display text-base font-semibold text-brand-ink mb-1">
            Ofertas recibidas
          </h2>
          <p className="text-sm text-brand-ink-soft mb-4">
            Marcas que te quieren regalar una muestra directamente a ti.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                defaultShipping={shipping}
                onShippingSaved={setShipping}
                onResolved={(offerId) =>
                  setOffers((prev) => prev.filter((x) => x.id !== offerId))
                }
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-base font-semibold text-brand-ink mb-1">
          Muestras disponibles
        </h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          Productos que las marcas ofrecen como muestra. Solicita la que te
          interese: cada marca revisa tu solicitud y decide si te la envía.
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
                      defaultShipping={shipping}
                      onCancel={() => setOpenProductId(null)}
                      onDone={(quantity, used) => {
                        setShipping(used);
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
