"use client";

import { useState } from "react";

type OrderItem = {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export type StoreOrderRow = {
  id: string;
  kind: "PURCHASE" | "SAMPLE";
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  reference: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingNotes: string | null;
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

export function StoreOrdersPanel({
  initialOrders,
}: {
  initialOrders: StoreOrderRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (initialOrders.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        Todavía no tienes pedidos — aparecerán acá apenas alguien compre en tu
        tienda o apruebes una muestra.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {initialOrders.map((order) => {
        const expanded = expandedId === order.id;
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
                      : "bg-brand-accent-soft text-brand-accent"
                  }`}
                >
                  {order.kind === "SAMPLE" ? "MUESTRA" : "COMPRA"}
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
                <div className="space-y-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-brand-ink-soft">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-mono">
                        {formatCOP(item.unitPriceCents * item.quantity)}
                      </span>
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
                    <p className="text-brand-ink font-medium mb-0.5">Envío</p>
                    <p>{order.shippingAddress}</p>
                    <p>{order.shippingCity}</p>
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
