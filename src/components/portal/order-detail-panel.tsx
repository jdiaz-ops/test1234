"use client";

import { useState } from "react";

export type OrderDetailItem = {
  id: string;
  name: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  imageUrl: string | null;
  serviceConfirmedAt: string | null;
  serviceMeetingInfo: string | null;
};

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

/// La marca confirma (o ajusta) la fecha/hora de una reserva de servicio
/// ya pagada, y si es virtual deja el link de la videollamada — antes
/// vivía dentro del acordeón de la lista, ahora en la página de detalle.
function ConfirmBookingForm({
  orderId,
  item,
  onConfirmed,
}: {
  orderId: string;
  item: OrderDetailItem;
  onConfirmed: (item: OrderDetailItem) => void;
}) {
  const [confirmedAt, setConfirmedAt] = useState("");
  const [meetingInfo, setMeetingInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!confirmedAt) {
      setError("Elige fecha y hora.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/pedidos/confirmar-servicio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          itemId: item.id,
          // Colombia: UTC-5 fijo todo el año, sin horario de verano.
          confirmedAt: `${confirmedAt}:00-05:00`,
          meetingInfo,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo confirmar.");
        return;
      }
      onConfirmed({
        ...item,
        serviceConfirmedAt: body.item.serviceConfirmedAt,
        serviceMeetingInfo: body.item.serviceMeetingInfo,
      });
    } catch {
      setError("No se pudo confirmar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg bg-brand-bg p-3 mt-2 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Fecha y hora confirmada
          </label>
          <input
            type="datetime-local"
            value={confirmedAt}
            onChange={(e) => setConfirmedAt(e.target.value)}
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">
            Link o notas (opcional)
          </label>
          <input
            value={meetingInfo}
            onChange={(e) => setMeetingInfo(e.target.value)}
            placeholder="https://zoom.us/..."
            className="input text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Confirmando..." : "Confirmar reserva"}
      </button>
    </div>
  );
}

export type FulfillmentStatusValue = "UNFULFILLED" | "PREPARED" | "SHIPPED" | "DELIVERED";

const FULFILLMENT_OPTIONS: { value: FulfillmentStatusValue; label: string }[] = [
  { value: "UNFULFILLED", label: "Sin preparar" },
  { value: "PREPARED", label: "Preparado" },
  { value: "SHIPPED", label: "Enviado" },
  { value: "DELIVERED", label: "Entregado" },
];

/// Estado de preparación/entrega — aparte del pago. Solo aplica a
/// pedidos físicos ya pagados (un pedido de servicio usa
/// ConfirmBookingForm arriba en su lugar). Ver conversación del
/// 2026-09-14: "estado del pago - estado de preparación del pedido".
export function OrderFulfillmentPanel({
  orderId,
  initialStatus,
  initialCarrier,
  initialTrackingNumber,
  preparedAt,
  shippedAt,
  deliveredAt,
}: {
  orderId: string;
  initialStatus: FulfillmentStatusValue;
  initialCarrier: string | null;
  initialTrackingNumber: string | null;
  preparedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}) {
  const [status, setStatus] = useState<FulfillmentStatusValue>(initialStatus);
  const [carrier, setCarrier] = useState(initialCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [times, setTimes] = useState({ preparedAt, shippedAt, deliveredAt });

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/marca/tienda/pedidos/preparacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          fulfillmentStatus: status,
          carrier,
          trackingNumber,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setTimes({
        preparedAt: body.order.preparedAt,
        shippedAt: body.order.shippedAt,
        deliveredAt: body.order.deliveredAt,
      });
      setSaved(true);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-brand-ink mb-1">Estado de preparación</label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as FulfillmentStatusValue);
            setSaved(false);
          }}
          className="input text-sm"
        >
          {FULFILLMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-brand-ink mb-1">Transportadora</label>
          <input
            value={carrier}
            onChange={(e) => {
              setCarrier(e.target.value);
              setSaved(false);
            }}
            placeholder="Ej. Servientrega"
            className="input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-ink mb-1">Número de guía</label>
          <input
            value={trackingNumber}
            onChange={(e) => {
              setTrackingNumber(e.target.value);
              setSaved(false);
            }}
            className="input text-sm"
          />
        </div>
      </div>
      {(times.preparedAt || times.shippedAt || times.deliveredAt) && (
        <div className="text-xs text-brand-ink-soft space-y-0.5">
          {times.preparedAt && <p>Preparado: {formatDateTime(times.preparedAt)}</p>}
          {times.shippedAt && <p>Enviado: {formatDateTime(times.shippedAt)}</p>}
          {times.deliveredAt && <p>Entregado: {formatDateTime(times.deliveredAt)}</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar"}
      </button>
    </div>
  );
}

/// Notas internas del pedido — nunca las ve el comprador.
export function OrderNotesEditor({
  orderId,
  initialNotes,
}: {
  orderId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/pedidos/notas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, internalNotes: notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value.slice(0, 2000));
          setSaved(false);
        }}
        placeholder="Solo tú ves estas notas — el comprador no."
        className="input text-sm min-h-20"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || saved}
        className="text-xs text-brand-accent font-medium hover:underline disabled:opacity-50 disabled:no-underline"
      >
        {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar nota"}
      </button>
    </div>
  );
}

export function OrderItemsList({
  orderId,
  initialItems,
  isService,
  isPaid,
}: {
  orderId: string;
  initialItems: OrderDetailItem[];
  isService: boolean;
  isPaid: boolean;
}) {
  const [items, setItems] = useState(initialItems);

  function updateItem(updated: OrderDetailItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  return (
    <div className="divide-y divide-brand-line">
      {items.map((item) => (
        <div key={item.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto del producto al momento de la compra
              <img
                src={item.imageUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-brand-line shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-brand-bg shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-ink truncate">
                {item.name}
              </p>
              {item.variantLabel && (
                <p className="text-xs text-brand-ink-soft">{item.variantLabel}</p>
              )}
              <p className="text-xs text-brand-ink-soft">
                {formatCOP(item.unitPriceCents)} × {item.quantity}
              </p>
            </div>
            <p className="font-mono text-sm text-brand-ink shrink-0">
              {formatCOP(item.unitPriceCents * item.quantity)}
            </p>
          </div>
          {isService && isPaid && (
            item.serviceConfirmedAt ? (
              <p className="text-xs text-brand-accent mt-2">
                Confirmado: {formatDateTime(item.serviceConfirmedAt)}
                {item.serviceMeetingInfo && ` — ${item.serviceMeetingInfo}`}
              </p>
            ) : (
              <ConfirmBookingForm
                orderId={orderId}
                item={item}
                onConfirmed={updateItem}
              />
            )
          )}
        </div>
      ))}
    </div>
  );
}
