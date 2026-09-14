import Link from "next/link";

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
  shippingRegion: string | null;
  shippingNotes: string | null;
  servicePreferredAt: string | null;
  discountCode: string | null;
  totalCents: number;
  createdAt: string;
  itemCount: number;
  /// null = venta directa, sin código de creador. Viene de Transaction
  /// (ya calculado por el Motor de Comisiones) — ver listBrandOrders.
  creator: {
    name: string;
    commissionPercent: number;
    commissionAmountCents: number | null;
  } | null;
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

/// Lista de pedidos: cada fila lleva al detalle completo en
/// /marca/tienda/pedidos/[orderId] — antes se expandía inline, ver
/// conversación del 2026-09-14 pidiendo una página de detalle real como la
/// de Shopify.
export function StoreOrdersPanel({
  initialOrders,
}: {
  initialOrders: StoreOrderRow[];
}) {
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
        const isService = order.servicePreferredAt != null;
        return (
          <Link
            key={order.id}
            href={`/marca/tienda/pedidos/${order.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-brand-line bg-brand-surface p-4 hover:border-brand-accent transition-colors"
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
                  {order.creator && ` · ${order.creator.name}`}
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
              <span className="text-brand-ink-soft text-xs">→</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
