import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createShopifyDiscountCode, ShopifyApiError } from "@/server/integrations/shopify-client";
import { createWooCommerceCoupon, WooCommerceApiError } from "@/server/integrations/woocommerce-client";

export class AttributionError extends Error {}

/// Motor de Atribución: recibe pedidos y reembolsos ya verificados (firma de
/// webhook comprobada por el caller) desde Shopify/WooCommerce, encuentra a
/// qué creador pertenece el código de descuento usado, y crea/actualiza el
/// Transaction correspondiente. El Motor de Comisiones (tarea siguiente)
/// consume estos Transaction para calcular el reparto — aquí no se toca
/// nada de comisiones todavía.

interface RecordOrderParams {
  brandId: string;
  source: "SHOPIFY" | "WOOCOMMERCE";
  externalOrderId: string;
  /// Código de descuento tal como vino en el pedido — puede venir con
  /// mayúsculas/espacios distintos a como se guardó, por eso se normaliza.
  discountCode: string | null;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  occurredAt: Date;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

/// Se llama justo después de que una inscripción queda ACTIVE (al unirse
/// directo en ofertas OPEN, o al aprobarla en ofertas APPROVAL). Intenta
/// crear el código de descuento real en la tienda de la marca si hay
/// credenciales guardadas; si falla o no hay tienda conectada, el código
/// del creador (ya guardado en discountCode desde que se creó la
/// inscripción) queda disponible igual para reporte manual — nunca bloquea
/// el flujo de unión de un creador.
export async function provisionDiscountCodeForEnrollment(enrollmentId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { creator: true, offer: { include: { brand: true } } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return;

  const { offer } = enrollment;
  const { brand } = offer;
  const discountPercent = Number(enrollment.discountPercentOverride ?? offer.defaultDiscountPercent);
  const code = enrollment.discountCode;

  try {
    if (brand.storeType === "SHOPIFY" && brand.storeUrl && brand.shopifyAccessToken) {
      const { priceRuleId } = await createShopifyDiscountCode({
        storeUrl: brand.storeUrl,
        accessToken: brand.shopifyAccessToken,
        code,
        discountPercent,
      });
      await prisma.creatorOfferEnrollment.update({
        where: { id: enrollmentId },
        data: { shopifyPriceRuleId: priceRuleId },
      });
    } else if (brand.storeType === "WOOCOMMERCE" && brand.storeUrl && brand.wooConsumerKey && brand.wooConsumerSecret) {
      const { couponId } = await createWooCommerceCoupon({
        storeUrl: brand.storeUrl,
        consumerKey: brand.wooConsumerKey,
        consumerSecret: brand.wooConsumerSecret,
        code,
        discountPercent,
      });
      await prisma.creatorOfferEnrollment.update({
        where: { id: enrollmentId },
        data: { wooCouponId: couponId },
      });
    }
    // Sin tienda conectada (StoreType.OTHER o sin credenciales): el código
    // queda registrado para que la marca lo cree a mano o reporte ventas
    // manualmente — comportamiento ya soportado desde el principio.
  } catch (err) {
    // No propagamos el error: el creador ya quedó unido a la oferta, y la
    // marca puede crear el código a mano mientras resuelve la conexión.
    // Guardamos evidencia visible marcando la tienda con error.
    const isKnownApiError = err instanceof ShopifyApiError || err instanceof WooCommerceApiError;
    console.error(
      `[atribución] No se pudo crear el código "${code}" en la tienda de la marca ${brand.id}:`,
      isKnownApiError ? err.message : err
    );
    await prisma.brandProfile.update({
      where: { id: brand.id },
      data: { storeConnectionStatus: "ERROR" },
    });
  }
}

/// Busca la inscripción activa de un creador en una marca a partir del
/// código de descuento usado en el pedido. Solo mira ofertas de esa marca —
/// el mismo código nunca se comparte entre marcas.
export async function findEnrollmentByDiscountCode(brandId: string, rawCode: string) {
  const code = normalizeCode(rawCode);
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: {
      status: "ACTIVE",
      offer: { brandId },
    },
    include: { offer: true },
  });
  return enrollments.find((e) => normalizeCode(e.discountCode) === code) ?? null;
}

/// Procesa un pedido nuevo (webhook `orders/create` de Shopify u
/// `order.created`/`order.updated` de WooCommerce). Idempotente: si ya
/// existe un Transaction para esa marca+fuente+orderId, no crea uno nuevo
/// (Shopify y WooCommerce reintentan el envío del webhook si no reciben 200
/// a tiempo).
export async function recordOrderFromWebhook(params: RecordOrderParams) {
  const existing = await prisma.transaction.findUnique({
    where: {
      brandId_source_externalOrderId: {
        brandId: params.brandId,
        source: params.source,
        externalOrderId: params.externalOrderId,
      },
    },
  });
  if (existing) return { transaction: existing, created: false as const };

  if (!params.discountCode) {
    // Pedido sin código de nuestro programa — no es un error, simplemente
    // no hay nada que atribuir (venta orgánica de la tienda).
    return { transaction: null, created: false as const, reason: "SIN_CODIGO" as const };
  }

  const enrollment = await findEnrollmentByDiscountCode(params.brandId, params.discountCode);
  if (!enrollment) {
    return { transaction: null, created: false as const, reason: "CODIGO_NO_ENCONTRADO" as const };
  }

  const transaction = await prisma.transaction.create({
    data: {
      brandId: params.brandId,
      offerId: enrollment.offerId,
      creatorId: enrollment.creatorId,
      enrollmentId: enrollment.id,
      source: params.source,
      externalOrderId: params.externalOrderId,
      grossAmount: new Prisma.Decimal(params.grossAmount),
      discountAmount: new Prisma.Decimal(params.discountAmount),
      netAmount: new Prisma.Decimal(params.netAmount),
      status: "COMPLETED",
      occurredAt: params.occurredAt,
    },
  });

  return { transaction, created: true as const };
}

/// Procesa un reembolso (webhook `refunds/create` de Shopify o
/// `order.updated`→status `refunded` de WooCommerce). Shopify/WooCommerce no
/// siempre indican si el reembolso fue parcial o total en el payload
/// mínimo que consumimos, así que por ahora se marca el pedido completo
/// como REFUNDED — esto detiene la comisión en la tarea siguiente, que es
/// el comportamiento seguro por defecto.
export async function recordRefundFromWebhook(params: {
  brandId: string;
  source: "SHOPIFY" | "WOOCOMMERCE";
  externalOrderId: string;
  refundedAt: Date;
}) {
  const transaction = await prisma.transaction.findUnique({
    where: {
      brandId_source_externalOrderId: {
        brandId: params.brandId,
        source: params.source,
        externalOrderId: params.externalOrderId,
      },
    },
  });

  if (!transaction) {
    return { transaction: null, updated: false as const, reason: "PEDIDO_NO_ENCONTRADO" as const };
  }
  if (transaction.status === "REFUNDED") {
    return { transaction, updated: false as const };
  }

  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: "REFUNDED", refundedAt: params.refundedAt },
  });

  return { transaction: updated, updated: true as const };
}
