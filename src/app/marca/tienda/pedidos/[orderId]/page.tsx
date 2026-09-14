import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import { getBrandOrderDetail } from "@/server/services/store-order-service";
import {
  OrderItemsList,
  OrderFulfillmentPanel,
  OrderNotesEditor,
} from "@/components/portal/order-detail-panel";

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  EXPIRED: "Vencido",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-brand-accent-soft text-brand-accent",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  UNFULFILLED: "Sin preparar",
  PREPARED: "Preparado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
};

const FULFILLMENT_CLASS: Record<string, string> = {
  UNFULFILLED: "bg-gray-100 text-gray-500",
  PREPARED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
};

export default async function TiendaPedidoDetallePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const { orderId } = await params;
  const order = await getBrandOrderDetail(profile.id, orderId);
  if (!order) notFound();

  const isService = order.servicePreferredAt != null;
  const creator = order.transaction
    ? {
        name: order.transaction.creator.displayName,
        commissionPercent: Number(
          order.transaction.enrollment.commissionPercentOverride ??
            order.transaction.enrollment.offer.defaultCommissionPercent,
        ),
        commissionAmountCents: order.transaction.commission
          ? Math.round(Number(order.transaction.commission.creatorCommissionAmount) * 100)
          : null,
      }
    : null;

  return (
    <div>
      <Link
        href="/marca/tienda/pedidos"
        className="text-xs text-brand-ink-soft hover:text-brand-ink inline-flex items-center gap-1 mb-4"
      >
        ← Volver a pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">
          Pedido de {order.buyerName}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_CLASS[order.status]}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
          {order.status === "PAID" && !isService && (
            <span
              className={`text-xs font-medium rounded-full px-2.5 py-1 ${FULFILLMENT_CLASS[order.fulfillmentStatus]}`}
            >
              {FULFILLMENT_LABEL[order.fulfillmentStatus]}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-brand-ink-soft mb-6">
        {formatDateTime(order.createdAt)} · Referencia{" "}
        <span className="font-mono">{order.reference}</span>
      </p>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
            <p className="text-sm font-medium text-brand-ink mb-3">
              {isService ? "Servicio reservado" : "Productos"}
            </p>
            <OrderItemsList
              orderId={order.id}
              isService={isService}
              isPaid={order.status === "PAID"}
              initialItems={order.items.map((i) => ({
                id: i.id,
                name: i.name,
                variantLabel: i.variantLabel,
                unitPriceCents: i.unitPriceCents,
                quantity: i.quantity,
                imageUrl: i.imageUrl,
                serviceConfirmedAt: i.serviceConfirmedAt?.toISOString() ?? null,
                serviceMeetingInfo: i.serviceMeetingInfo,
              }))}
            />
          </div>

          {order.status === "PAID" && !isService && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <p className="text-sm font-medium text-brand-ink mb-3">
                Preparación y envío
              </p>
              <OrderFulfillmentPanel
                orderId={order.id}
                initialStatus={order.fulfillmentStatus}
                initialCarrier={order.carrier}
                initialTrackingNumber={order.trackingNumber}
                preparedAt={order.preparedAt?.toISOString() ?? null}
                shippedAt={order.shippedAt?.toISOString() ?? null}
                deliveredAt={order.deliveredAt?.toISOString() ?? null}
              />
            </div>
          )}

          {order.shippingNotes && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <p className="text-sm font-medium text-brand-ink mb-2">
                Notas del comprador
              </p>
              <p className="text-sm text-brand-ink-soft">{order.shippingNotes}</p>
            </div>
          )}

          <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
            <p className="text-sm font-medium text-brand-ink mb-2">Notas internas</p>
            <OrderNotesEditor orderId={order.id} initialNotes={order.internalNotes} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-brand-ink-soft mb-1">
                Cliente
              </p>
              <p className="text-brand-ink">{order.buyerName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-brand-ink-soft mb-1">
                Contacto
              </p>
              <p className="text-brand-ink">{order.buyerEmail}</p>
              <p className="text-brand-ink">{order.buyerPhone}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-brand-ink-soft mb-1">
                {isService ? "Reserva" : "Envío"}
              </p>
              {isService ? (
                <p className="text-brand-ink">
                  Prefiere: {formatDateTime(order.servicePreferredAt!)}
                </p>
              ) : (
                <>
                  <p className="text-brand-ink">{order.shippingAddress}</p>
                  <p className="text-brand-ink">
                    {order.shippingCity}
                    {order.shippingRegion && `, ${order.shippingRegion}`}
                  </p>
                </>
              )}
            </div>
          </div>

          {(order.discountCode || creator) && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-1.5 text-sm">
              <p className="text-xs font-medium text-brand-ink-soft mb-1">
                Atribución
              </p>
              {order.discountCode && (
                <p className="text-brand-ink-soft">
                  Código usado:{" "}
                  <span className="font-mono text-brand-ink">
                    {order.discountCode}
                  </span>
                </p>
              )}
              {creator ? (
                <p className="text-brand-ink-soft">
                  Creador:{" "}
                  <span className="font-medium text-brand-ink">
                    {creator.name}
                  </span>{" "}
                  — comisión {creator.commissionPercent}%
                  {creator.commissionAmountCents != null && (
                    <> ({formatCOP(creator.commissionAmountCents)})</>
                  )}
                </p>
              ) : (
                <p className="text-brand-ink-soft">Venta directa, sin creador.</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-2 text-sm">
            <p className="text-xs font-medium text-brand-ink-soft mb-1">
              Pago
            </p>
            <div className="flex justify-between">
              <span className="text-brand-ink-soft">Subtotal</span>
              <span className="font-mono text-brand-ink">
                {formatCOP(order.subtotalCents)}
              </span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-brand-ink-soft">Descuento</span>
                <span className="font-mono text-brand-ink">
                  −{formatCOP(order.discountCents)}
                </span>
              </div>
            )}
            {!isService && (
              <div className="flex justify-between">
                <span className="text-brand-ink-soft">Envío</span>
                <span className="font-mono text-brand-ink">
                  {order.shippingCents === 0
                    ? "Gratis"
                    : formatCOP(order.shippingCents)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-brand-line font-medium">
              <span className="text-brand-ink">Total</span>
              <span className="font-mono text-brand-ink">
                {formatCOP(order.totalCents)}
              </span>
            </div>
            {order.paidAt && (
              <p className="text-xs text-brand-ink-soft pt-1">
                Pagado el {formatDateTime(order.paidAt)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
