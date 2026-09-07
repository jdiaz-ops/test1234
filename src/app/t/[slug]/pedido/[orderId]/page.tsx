import { notFound } from "next/navigation";
import Link from "next/link";
import { getStoreOrder } from "@/server/services/store-order-service";
import {
  getActiveWompiKeys,
  fetchWompiTransaction,
  WompiApiError,
} from "@/server/integrations/wompi-client";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";
import { ClearCartIfPaid } from "@/components/storefront/clear-cart-if-paid";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  PAID: {
    title: "¡Listo! Tu pago fue aprobado",
    body: "La marca ya puede ver tu pedido y preparar el envío.",
  },
  PENDING: {
    title: "Esperando confirmación del pago",
    body: "Esto puede tardar unos segundos — actualiza la página si no cambia.",
  },
  FAILED: {
    title: "El pago no se pudo completar",
    body: "Puedes volver a intentarlo desde tu carrito.",
  },
  EXPIRED: {
    title: "El pedido venció",
    body: "Vuelve a la tienda para hacer el pedido de nuevo.",
  },
};

export default async function StorefrontOrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug, orderId } = await params;
  const { id: wompiId } = await searchParams;

  let order = await getStoreOrder(orderId);
  if (!order || order.brand.storefrontSlug !== slug) notFound();

  // Wompi redirige acá con `?id=` apenas el comprador termina en su
  // widget — casi siempre llega antes que el webhook, así que lo
  // consultamos de una vez en vez de dejar al comprador viendo "pendiente"
  // más de lo necesario.
  if (order.status === "PENDING" && wompiId) {
    const keys = getActiveWompiKeys(order.brand);
    if (keys) {
      try {
        const txn = await fetchWompiTransaction(
          keys.mode,
          keys.publicKey,
          wompiId,
        );
        if (txn && txn.reference === order.reference) {
          await applyWompiTransactionStatus({
            reference: order.reference,
            wompiTransactionId: txn.id,
            wompiStatus: txn.status,
          });
          order = await getStoreOrder(orderId);
        }
      } catch (err) {
        if (!(err instanceof WompiApiError)) throw err;
      }
    }
  }

  if (!order) notFound();

  const copy = STATUS_COPY[order.status] ?? STATUS_COPY.PENDING;
  const isService = order.servicePreferredAt != null;
  const allServicesConfirmed = order.items.every((i) => i.serviceConfirmedAt != null);

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6 py-16">
      {order.status === "PAID" && <ClearCartIfPaid brandSlug={slug} />}
      <div className="max-w-md w-full rounded-2xl border border-brand-line bg-brand-surface p-8 text-center">
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-3">
          PEDIDO {order.reference.slice(-8).toUpperCase()}
        </p>
        <h1 className="font-display text-xl font-semibold text-brand-ink mb-2">
          {copy.title}
        </h1>
        <p className="text-sm text-brand-ink-soft mb-6">
          {order.status === "PAID" && isService
            ? allServicesConfirmed
              ? "Tu reserva quedó confirmada — mira los detalles abajo."
              : "La marca va a confirmar (o proponerte otra) la fecha y hora — te avisamos por correo."
            : copy.body}
        </p>

        <div className="text-left rounded-xl border border-brand-line p-4 mb-6 space-y-1.5 text-sm">
          {order.items.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between">
                <span className="text-brand-ink-soft">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-mono">
                  {formatCOP((item.unitPriceCents * item.quantity) / 100)}
                </span>
              </div>
              {isService && order.status === "PAID" && (
                <p className="text-xs mt-0.5">
                  {item.serviceConfirmedAt ? (
                    <span className="text-brand-accent">
                      Confirmado:{" "}
                      {new Date(item.serviceConfirmedAt).toLocaleString("es-CO", {
                        dateStyle: "long",
                        timeStyle: "short",
                        timeZone: "America/Bogota",
                      })}
                      {item.serviceMeetingInfo && ` — ${item.serviceMeetingInfo}`}
                    </span>
                  ) : (
                    <span className="text-brand-ink-soft">
                      Pediste:{" "}
                      {order.servicePreferredAt &&
                        new Date(order.servicePreferredAt).toLocaleString("es-CO", {
                          dateStyle: "long",
                          timeStyle: "short",
                          timeZone: "America/Bogota",
                        })}{" "}
                      — pendiente de confirmar
                    </span>
                  )}
                </p>
              )}
            </div>
          ))}
          <div className="flex justify-between font-semibold text-brand-ink pt-2 border-t border-brand-line mt-2">
            <span>Total</span>
            <span className="font-mono">
              {formatCOP(order.totalCents / 100)}
            </span>
          </div>
        </div>

        <Link
          href={`/t/${slug}`}
          className="inline-block rounded-full bg-brand-accent text-white px-5 py-2 text-sm font-semibold hover:opacity-90"
        >
          Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
