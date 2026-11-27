import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import { canDeleteStoreOrder, getBrandOrderDetail } from "@/server/services/store-order-service";
import { PAYMENT_PROVIDERS, isPaymentProviderId } from "@/lib/payment-providers";
import { OrderArchiveActions } from "@/components/portal/order-archive-actions";
import { getDataicoConnection } from "@/server/services/dataico-service";
import { getEnviaConnection } from "@/server/services/envia-service";
import { dataicoAllowed, enviaAllowed } from "@/lib/features";
import { enviaStatusLabel } from "@/lib/envia-address";
import { OrderEnviaPanel } from "@/components/portal/order-envia-panel";
import { OrderInvoicePanel } from "@/components/portal/order-invoice-panel";
import { prisma } from "@/lib/prisma";
import { creatorVitrinaUrl } from "@/lib/creator-identity";
import { formatDateTimeCo } from "@/lib/date-time-co";
import {
  OrderItemsList,
  OrderFulfillmentPanel,
  OrderNotesEditor,
  OrderRefundPanel,
} from "@/components/portal/order-detail-panel";

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/// La misma forma que el panel del pedido (ver date-time-co.ts).
const formatDateTime = formatDateTimeCo;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  EXPIRED: "Vencido",
  REFUNDED: "Devuelto",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-brand-accent-soft text-brand-accent",
  FAILED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  REFUNDED: "bg-purple-100 text-purple-700",
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
  const showEnvia = enviaAllowed(profile);
  const [order, dataico, envia] = await Promise.all([
    getBrandOrderDetail(profile.id, orderId),
    // Dataico solo para las tiendas de DATAICO_STORE_SLUGS.
    dataicoAllowed(profile) ? getDataicoConnection(profile.id) : null,
    // Y Envia para las de ENVIA_STORE_SLUGS.
    showEnvia ? getEnviaConnection(profile.id) : null,
  ]);
  if (!order) notFound();

  const isService = order.servicePreferredAt != null;
  // Un pedido digital tampoco tiene fecha de servicio ni dirección — se
  // distingue de uno físico por eso (ver createStoreOrder, que deja ambos
  // en null solo para pedidos DIGITAL).
  const isDigital = !isService && order.shippingAddress == null;
  // Venta aún sin registrar (ej. pedido pendiente): el creador sale del
  // código usado en esta marca.
  const codeOwner =
    !order.transaction && order.discountCode
      ? await prisma.creatorOfferEnrollment.findFirst({
          where: {
            discountCode: { equals: order.discountCode, mode: "insensitive" },
            offer: { brandId: profile.id },
          },
          select: {
            commissionPercentOverride: true,
            offer: { select: { defaultCommissionPercent: true } },
            creator: { select: { displayName: true, storefrontSlug: true } },
          },
        })
      : null;
  const creator = order.transaction
    ? {
        name: order.transaction.creator.displayName,
        vitrinaUrl: await creatorVitrinaUrl(order.transaction.creator.storefrontSlug),
        commissionPercent: Number(
          order.transaction.enrollment.commissionPercentOverride ??
            order.transaction.enrollment.offer.defaultCommissionPercent,
        ),
        commissionAmountCents: order.transaction.commission
          ? Math.round(Number(order.transaction.commission.creatorCommissionAmount) * 100)
          : null,
      }
    : codeOwner
      ? {
          name: codeOwner.creator.displayName,
          vitrinaUrl: await creatorVitrinaUrl(codeOwner.creator.storefrontSlug),
          commissionPercent: Number(codeOwner.commissionPercentOverride ?? codeOwner.offer.defaultCommissionPercent),
          commissionAmountCents: null,
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
          {order.status === "PAID" && !isService && !isDigital && (
            <span
              className={`text-xs font-medium rounded-full px-2.5 py-1 ${FULFILLMENT_CLASS[order.fulfillmentStatus]}`}
            >
              {FULFILLMENT_LABEL[order.fulfillmentStatus]}
            </span>
          )}
          <OrderArchiveActions
            orderId={order.id}
            archived={order.archivedAt != null}
            deletable={canDeleteStoreOrder(order)}
          />
        </div>
      </div>
      <p className="text-sm text-brand-ink-soft mb-6">
        {formatDateTime(order.createdAt)} · Referencia{" "}
        <span className="font-mono">{order.reference}</span>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          {order.status === "PAID" && !isService && !isDigital && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <p className="text-sm font-medium text-brand-ink mb-3">
                Preparación y envío
              </p>
              {envia ? (
                <div className="mb-4">
                  <OrderEnviaPanel
                    orderId={order.id}
                    sandbox={envia.sandbox}
                    label={
                      order.enviaCarrier && order.trackingNumber
                        ? {
                            carrier: order.carrier ?? order.enviaCarrier,
                            trackingNumber: order.trackingNumber,
                            labelUrl: order.enviaLabelUrl,
                            trackUrl: order.trackingUrl,
                            costCents: order.enviaCostCents,
                            statusLabel:
                              order.fulfillmentStatus === "DELIVERED" ? "Entregado" : enviaStatusLabel(order.enviaStatus),
                            delivered: order.fulfillmentStatus === "DELIVERED",
                          }
                        : null
                    }
                    defaults={{
                      lengthCm: envia.packageLengthCm,
                      widthCm: envia.packageWidthCm,
                      heightCm: envia.packageHeightCm,
                      weightGrams: envia.packageWeightGrams,
                      declaredValue: Math.max(0, Math.round((order.subtotalCents - order.discountCents) / 100)),
                      street: (order.shippingAddress ?? "").slice(0, 200),
                      region: order.shippingRegion ?? "",
                      city: order.shippingCity ?? "",
                      reference: (order.shippingNotes ?? "").slice(0, 120),
                    }}
                  />
                </div>
              ) : (
                showEnvia && (
                  <p className="text-xs text-brand-ink-soft mb-3">
                    ¿Despachas con Envia?{" "}
                    <Link href="/marca/tienda/conexiones" className="text-brand-accent hover:underline">
                      Conecta tu cuenta
                    </Link>{" "}
                    y crea la guía desde aquí.
                  </p>
                )
              )}
              <OrderFulfillmentPanel
                // Se vuelve a armar cuando la guía de Envia cambia el envío.
                key={`${order.trackingNumber ?? ""}-${order.fulfillmentStatus}`}
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
              {order.billingIdType && order.billingIdNumber && (
                <p className="text-brand-ink-soft text-xs">
                  {order.billingIdType} {order.billingIdNumber}
                  {order.billingName && ` · ${order.billingName}`}
                </p>
              )}
              {order.acceptsMarketing && (
                <p className="text-brand-ink-soft text-xs">Acepta novedades por correo</p>
              )}
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
                {isService ? "Reserva" : isDigital ? "Entrega" : "Envío"}
              </p>
              {isService ? (
                <p className="text-brand-ink">
                  Prefiere: {formatDateTime(order.servicePreferredAt!)}
                </p>
              ) : isDigital ? (
                <p className="text-brand-ink">
                  Digital — sin envío, se entrega por link.
                </p>
              ) : (
                <>
                  <p className="text-brand-ink">{order.shippingAddress}</p>
                  <p className="text-brand-ink">
                    {order.shippingCity}
                    {order.shippingRegion && `, ${order.shippingRegion}`}
                    {order.shippingPostalCode && ` · ${order.shippingPostalCode}`}
                  </p>
                  {order.shippingMethod && (
                    <p className="text-brand-ink-soft text-xs mt-1">{order.shippingMethod}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {order.billingAddress && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 text-sm">
              <p className="text-xs font-medium text-brand-ink-soft mb-1">Dirección de facturación</p>
              <p className="text-brand-ink">{order.billingAddress}</p>
              <p className="text-brand-ink">
                {order.billingCity}
                {order.billingRegion && `, ${order.billingRegion}`}
              </p>
            </div>
          )}

          {(order.discountCode || creator) && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-1.5 text-sm">
              <p className="text-xs font-medium text-brand-ink-soft mb-1">
                {creator ? "Venta de creador" : "Atribución"}
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
                  <a
                    href={creator.vitrinaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-ink hover:text-brand-accent hover:underline"
                  >
                    {creator.name}
                  </a>{" "}
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
            {order.taxCents > 0 && (
              <div className="flex justify-between">
                <span className="text-brand-ink-soft">IVA incluido en el precio</span>
                <span className="font-mono text-brand-ink">
                  {formatCOP(order.taxCents)}
                </span>
              </div>
            )}
            {order.shippingAddress != null && (
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

          {dataico?.enabled && order.kind === "PURCHASE" && (order.status === "PAID" || order.einvoiceStatus) && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-2">
              <p className="text-xs font-medium text-brand-ink-soft">Factura electrónica</p>
              <OrderInvoicePanel
                orderId={order.id}
                status={order.einvoiceStatus}
                number={order.einvoiceNumber}
                pdfUrl={order.einvoicePdfUrl}
                cufe={order.einvoiceCufe}
                error={order.einvoiceError}
                billing={
                  order.billingIdType && order.billingIdNumber
                    ? `${order.billingName ?? order.buyerName} · ${order.billingIdType} ${order.billingIdNumber}`
                    : "Consumidor final"
                }
              />
            </div>
          )}

          {(order.status === "PAID" || order.status === "REFUNDED") && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-2">
              <p className="text-xs font-medium text-brand-ink-soft">Devolución</p>
              <OrderRefundPanel
                orderId={order.id}
                totalLabel={formatCOP(order.totalCents)}
                refundHint={isPaymentProviderId(order.paymentProvider) ? PAYMENT_PROVIDERS[order.paymentProvider].refundHint : undefined}
                hasPhysicalItems={!isService && !isDigital}
                refund={
                  order.status === "REFUNDED" && order.refundedAt
                    ? {
                        refundedAt: order.refundedAt.toISOString(),
                        reason: order.refundReason,
                        restocked: order.restocked,
                      }
                    : null
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
