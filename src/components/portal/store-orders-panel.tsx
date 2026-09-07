"use client";

import { useState } from "react";

type OrderItem = {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  serviceConfirmedAt: string | null;
  serviceMeetingInfo: string | null;
};

export type StoreOrderRow = {
  id: string;
  kind: "PURCHASE" | "SAMPLE";
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  reference: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingNotes: string | null;
  servicePreferredAt: string | null;
  discountCode: string | null;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

const STATUS_LABEL: Record<StoreOrderRow["status"], string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  EXPIRED: "Vencido",
};

const STATUS_CLASS: Record<StoreOrderRow["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-brand-accent-soft text-brand-accent",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

function ConfirmBookingForm({
  orderId,
  item,
  onConfirmed,
}: {
  orderId: string;
  item: OrderItem;
  onConfirmed: (item: OrderItem) => void;
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

export function StoreOrdersPanel({
  initialOrders,
}: {
  initialOrders: StoreOrderRow[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no tienes pedidos — aparecerán acá apenas alguien compre en tu
        tienda o apruebes una muestra.
      </p>
    );
  }

  function updateItem(orderId: string, updated: OrderItem) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id !== orderId
          ? o
          : { ...o, items: o.items.map((i) => (i.id === updated.id ? updated : i)) },
      ),
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const expanded = expandedId === order.id;
        const isService = order.servicePreferredAt != null;
        return (
          <div
            key={order.id}
            className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : order.id)}
              className="w-full flex items-center justify-between gap-4 p-4 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`text-[10px] font-mono font-medium rounded-full px-2 py-0.5 shrink-0 ${
                    order.kind === "SAMPLE"
                      ? "bg-purple-100 text-purple-700"
                      : isService
                        ? "bg-purple-100 text-purple-700"
                        : "bg-brand-accent-soft text-brand-accent"
                  }`}
                >
                  {order.kind === "SAMPLE"
                    ? "MUESTRA"
                    : isService
                      ? "RESERVA"
                      : "COMPRA"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-ink truncate">
                    {order.buyerName}
                  </p>
                  <p className="text-xs text-brand-ink-soft">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_CLASS[order.status]}`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
                <span className="font-mono text-sm text-brand-ink">
                  {formatCOP(order.totalCents)}
                </span>
                <span className="text-brand-ink-soft text-xs">
                  {expanded ? "▾" : "▸"}
                </span>
              </div>
            </button>

            {expanded && (
              <div className="border-t border-brand-line p-4 space-y-3 text-sm">
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id}>
                      <div className="flex justify-between">
                        <span className="text-brand-ink-soft">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="font-mono">
                          {formatCOP(item.unitPriceCents * item.quantity)}
                        </span>
                      </div>
                      {isService && order.status === "PAID" && (
                        item.serviceConfirmedAt ? (
                          <p className="text-xs text-brand-accent mt-1">
                            Confirmado: {formatDateTime(item.serviceConfirmedAt)}
                            {item.serviceMeetingInfo && ` — ${item.serviceMeetingInfo}`}
                          </p>
                        ) : (
                          <ConfirmBookingForm
                            orderId={order.id}
                            item={item}
                            onConfirmed={(updated) => updateItem(order.id, updated)}
                          />
                        )
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-brand-ink-soft pt-2 border-t border-brand-line">
                  <div>
                    <p className="text-brand-ink font-medium mb-0.5">
                      Contacto
                    </p>
                    <p>{order.buyerEmail}</p>
                    <p>{order.buyerPhone}</p>
                  </div>
                  <div>
                    <p className="text-brand-ink font-medium mb-0.5">
                      {isService ? "Reserva" : "Envío"}
                    </p>
                    {isService ? (
                      <p>
                        Prefiere: {formatDateTime(order.servicePreferredAt!)}
                      </p>
                    ) : (
                      <>
                        <p>{order.shippingAddress}</p>
                        <p>{order.shippingCity}</p>
                      </>
                    )}
                    {order.shippingNotes && <p>{order.shippingNotes}</p>}
                  </div>
                </div>
                {order.discountCode && (
                  <p className="text-xs text-brand-ink-soft">
                    Código usado:{" "}
                    <span className="font-mono text-brand-ink">
                      {order.discountCode}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
