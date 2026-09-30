import { prisma } from "@/lib/prisma";
import {
  sendOrderConfirmationEmail,
  sendNewOrderBrandEmail,
  sendOrderShippedEmail,
  sendOrderRefundedEmail,
  type OrderEmailData,
} from "@/lib/email";
import { orderNumber } from "@/lib/order-math";
import { publicStoreUrl, portalUrl } from "@/lib/store-url";
import { trackingUrlFor } from "@/lib/carriers";

/// Correos de pedidos de "Mi tienda". Ninguno debe tumbar la acción que lo
/// dispara (el pago ya se cobró, el envío ya se marcó): cada función
/// atrapa sus errores y los deja en el log.

async function loadOrder(orderId: string) {
  return prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      brand: {
        select: {
          companyName: true,
          logoUrl: true,
          storefrontSlug: true,
          customDomain: true,
          customDomainVerifiedAt: true,
          user: { select: { email: true } },
        },
      },
    },
  });
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function toEmailData(order: LoadedOrder): OrderEmailData {
  return {
    orderNumber: orderNumber(order.reference),
    brandName: order.brand.companyName,
    brandLogoUrl: order.brand.logoUrl,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    buyerPhone: order.buyerPhone,
    items: order.items.map((i) => ({
      name: i.name,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    discountCode: order.discountCode,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity,
    shippingRegion: order.shippingRegion,
    shippingNotes: order.shippingNotes,
  };
}

function buyerOrderUrl(order: LoadedOrder) {
  const store = publicStoreUrl(order.brand);
  return store ? `${store}/pedido/${order.id}` : null;
}

/// Pago aprobado: confirmación al comprador + aviso de venta a la marca.
export async function sendOrderPaidEmails(orderId: string) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return;
    const data = toEmailData(order);
    await sendOrderConfirmationEmail(data, buyerOrderUrl(order));
    if (order.brand.user?.email) {
      await sendNewOrderBrandEmail(order.brand.user.email, data, `${portalUrl()}/marca/tienda/pedidos/${order.id}`);
    }
  } catch (err) {
    console.error(`[mi-tienda] No se pudieron enviar los correos del pedido ${orderId}:`, err);
  }
}

/// Pedido marcado como enviado: guía y link de rastreo al comprador.
export async function sendOrderShippedEmailFor(orderId: string) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return;
    await sendOrderShippedEmail(
      toEmailData(order),
      {
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        trackingUrl: trackingUrlFor(order.carrier),
      },
      buyerOrderUrl(order),
    );
  } catch (err) {
    console.error(`[mi-tienda] No se pudo enviar el aviso de envío del pedido ${orderId}:`, err);
  }
}

/// Devolución registrada por la marca.
export async function sendOrderRefundedEmailFor(orderId: string, reason: string | null) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return;
    await sendOrderRefundedEmail(toEmailData(order), reason);
  } catch (err) {
    console.error(`[mi-tienda] No se pudo enviar el aviso de devolución del pedido ${orderId}:`, err);
  }
}
