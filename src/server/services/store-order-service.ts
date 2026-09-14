import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getActiveWompiKeys,
  buildIntegritySignature,
} from "@/server/integrations/wompi-client";
import {
  findEnrollmentByDiscountCode,
  recordOrderFromWebhook,
} from "@/server/services/attribution-service";
import { sendServiceBookingConfirmedEmail } from "@/lib/email";
import {
  listShippingZones,
  matchShippingZone,
} from "@/server/services/shipping-zone-service";

/// Carrito y checkout nativos de "Mi tienda" — la vitrina pública de una
/// marca en marcolini.lat/t/{storefrontSlug}. El carrito vive en el
/// navegador (localStorage); este servicio solo entra en juego al pasar al
/// checkout: valida productos y código, calcula totales, y arma lo que
/// necesita el botón de Wompi para cobrar con las llaves propias de la
/// marca.

export class StoreOrderError extends Error {}

export async function getStorefrontBrand(slug: string) {
  return prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
}

export async function listStorefrontProducts(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: true, available: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStorefrontProduct(brandId: string, slug: string) {
  return prisma.product.findFirst({
    where: { brandId, manual: true, slug },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
    },
  });
}

/// Valida un código de creador sin crear nada — se usa para mostrar el
/// descuento en vivo en el checkout antes de confirmar el pedido.
export async function previewDiscountCode(brandId: string, rawCode: string) {
  const enrollment = await findEnrollmentByDiscountCode(brandId, rawCode);
  if (!enrollment) {
    throw new StoreOrderError("Ese código no aplica para esta tienda.");
  }
  const discountPercent = Number(
    enrollment.discountPercentOverride ??
      enrollment.offer.defaultDiscountPercent,
  );
  return { discountPercent };
}

type CartItemInput = {
  productId: string;
  /// Solo si el producto tiene variantes — ver Product.hasVariants.
  variantId?: string;
  quantity: number;
};

type CreateOrderInput = {
  items: CartItemInput[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  /// Solo hace falta si el carrito trae algún producto PHYSICAL — ver el
  /// chequeo de "no mezclar tipos" más abajo.
  shippingAddress?: string;
  shippingCity?: string;
  /// Departamento elegido en el checkout — determina qué zona de envío
  /// aplica (ver matchShippingZone). Requerido junto con shippingAddress/
  /// shippingCity para un carrito con productos físicos.
  shippingRegion?: string;
  shippingNotes?: string | null;
  /// Solo hace falta si el carrito es 100% de servicios.
  servicePreferredAt?: string | null;
  discountCode?: string | null;
};

const REDIRECT_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export async function createStoreOrder(slug: string, input: CreateOrderInput) {
  if (input.items.length === 0) {
    throw new StoreOrderError("El carrito está vacío.");
  }

  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
  if (!brand) throw new StoreOrderError("Tienda no encontrada.");

  const keys = getActiveWompiKeys(brand);
  if (!keys) {
    throw new StoreOrderError(
      "Esta tienda todavía no activó los pagos — vuelve más tarde.",
    );
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, brandId: brand.id, manual: true },
    include: { variants: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotalCents = 0;
  const itemsData: {
    productId: string;
    variantId: string | null;
    variantLabel: string | null;
    name: string;
    unitPriceCents: number;
    quantity: number;
    imageUrl: string | null;
  }[] = [];

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product || !product.available) {
      throw new StoreOrderError("Uno de los productos ya no está disponible.");
    }
    if (item.quantity < 1) {
      throw new StoreOrderError("Cantidad inválida.");
    }

    let unitPrice = Number(product.price);
    let itemImageUrl = product.imageUrl;
    let variantId: string | null = null;
    let variantLabel: string | null = null;

    if (product.hasVariants) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) {
        throw new StoreOrderError(
          `Elige una combinación válida de "${product.name}".`,
        );
      }
      if (variant.stock < item.quantity) {
        throw new StoreOrderError(
          `No hay suficiente stock de "${product.name}" en esa combinación.`,
        );
      }
      unitPrice = variant.price != null ? Number(variant.price) : unitPrice;
      itemImageUrl = variant.imageUrl ?? itemImageUrl;
      variantId = variant.id;
      variantLabel = product.optionNames
        .map((name, idx) => {
          const value = [
            variant.option1Value,
            variant.option2Value,
            variant.option3Value,
          ][idx];
          return value ? `${name}: ${value}` : null;
        })
        .filter(Boolean)
        .join(" · ");
    } else if (product.stock != null && product.stock < item.quantity) {
      throw new StoreOrderError(
        product.type === "SERVICE"
          ? `No quedan cupos de "${product.name}".`
          : `No hay suficiente stock de "${product.name}".`,
      );
    }

    const unitPriceCents = Math.round(unitPrice * 100);
    subtotalCents += unitPriceCents * item.quantity;
    itemsData.push({
      productId: product.id,
      variantId,
      variantLabel,
      name: product.name,
      unitPriceCents,
      quantity: item.quantity,
      imageUrl: itemImageUrl,
    });
  }

  // Un carrito nunca mezcla productos físicos con servicios — necesitan
  // datos distintos al pagar (envío vs. fecha/hora) y sería confuso
  // resolver ambos en un mismo formulario. Si el comprador quiere las dos
  // cosas, hace dos pedidos separados.
  const cartTypes = new Set(input.items.map((i) => productMap.get(i.productId)!.type));
  if (cartTypes.size > 1) {
    throw new StoreOrderError(
      "No puedes mezclar productos y servicios en el mismo pedido — hazlos por separado.",
    );
  }
  const isServiceOrder = cartTypes.has("SERVICE");

  let servicePreferredAt: Date | null = null;
  if (isServiceOrder) {
    if (!input.servicePreferredAt) {
      throw new StoreOrderError("Elige la fecha y hora que prefieres.");
    }
    servicePreferredAt = new Date(input.servicePreferredAt);
    if (Number.isNaN(servicePreferredAt.getTime()) || servicePreferredAt.getTime() < Date.now()) {
      throw new StoreOrderError("Elige una fecha y hora válida, más adelante en el tiempo.");
    }
  } else {
    if (
      !input.shippingAddress?.trim() ||
      !input.shippingCity?.trim() ||
      !input.shippingRegion?.trim()
    ) {
      throw new StoreOrderError(
        "Ingresa tu dirección, ciudad y departamento de envío.",
      );
    }
  }

  let discountCode: string | null = null;
  let discountCents = 0;
  if (input.discountCode && input.discountCode.trim()) {
    const { discountPercent } = await previewDiscountCode(
      brand.id,
      input.discountCode,
    );
    discountCode = input.discountCode.trim().toUpperCase();
    discountCents = Math.round((subtotalCents * discountPercent) / 100);
  }

  const afterDiscount = subtotalCents - discountCents;

  // Zona de envío que cubra el departamento elegido (o la zona catch-all
  // "Resto de Colombia") — si la marca no creó ninguna zona, o ninguna
  // cubre esa región, se usa la tarifa/umbral únicos de siempre
  // (BrandProfile.shippingFlatRate/freeShippingThreshold) como respaldo.
  // Ver conversación del 2026-09-14 pidiendo poder cobrar distinto según
  // a dónde se envía.
  let shippingRateCents = brand.shippingFlatRate
    ? Math.round(Number(brand.shippingFlatRate) * 100)
    : 0;
  let shippingFreeThresholdCents = brand.freeShippingThreshold
    ? Math.round(Number(brand.freeShippingThreshold) * 100)
    : null;

  if (!isServiceOrder && input.shippingRegion) {
    const zones = await listShippingZones(brand.id);
    const zone = matchShippingZone(zones, input.shippingRegion);
    if (zone) {
      shippingRateCents = Math.round(Number(zone.price) * 100);
      shippingFreeThresholdCents = zone.freeShippingThreshold
        ? Math.round(Number(zone.freeShippingThreshold) * 100)
        : null;
    }
  }

  // Un servicio no se envía — nunca cobra flete, sin importar la
  // configuración de envíos de la marca.
  const shippingCents = isServiceOrder
    ? 0
    : shippingFreeThresholdCents != null && afterDiscount >= shippingFreeThresholdCents
      ? 0
      : shippingRateCents;

  const totalCents = afterDiscount + shippingCents;
  if (totalCents <= 0) {
    throw new StoreOrderError("El total del pedido debe ser mayor a cero.");
  }

  const reference = `mt_${randomUUID()}`;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.storeOrder.create({
      data: {
        brandId: brand.id,
        reference,
        buyerName: input.buyerName.trim(),
        buyerEmail: input.buyerEmail.trim().toLowerCase(),
        buyerPhone: input.buyerPhone.trim(),
        shippingAddress: isServiceOrder ? null : input.shippingAddress!.trim(),
        shippingCity: isServiceOrder ? null : input.shippingCity!.trim(),
        shippingRegion: isServiceOrder ? null : input.shippingRegion!.trim(),
        servicePreferredAt,
        shippingNotes: input.shippingNotes?.trim() || null,
        discountCode,
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
        paymentMode: keys.mode,
        items: { create: itemsData },
      },
    });
    return created;
  });

  const signature = buildIntegritySignature({
    reference,
    amountInCents: totalCents,
    currency: order.currency,
    integrityKey: keys.integrityKey,
  });

  return {
    order,
    wompi: {
      publicKey: keys.publicKey,
      currency: order.currency,
      amountInCents: totalCents,
      reference,
      signature,
      redirectUrl: `${REDIRECT_BASE}/t/${slug}/pedido/${order.id}`,
    },
  };
}

export async function getStoreOrder(orderId: string) {
  return prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: { items: true, brand: true },
  });
}

/// Para el submódulo "Pedidos" del portal de marca — incluye compras
/// (kind PURCHASE) y muestras aprobadas (kind SAMPLE) en la misma lista,
/// más recientes primero. Trae también el creador y la comisión de cada
/// pedido atribuido (vía Transaction, que ya calculó todo el Motor de
/// Comisiones) — ver conversación del 2026-09-14 pidiendo mostrar esto en
/// el detalle de cada pedido.
export async function listBrandOrders(brandId: string) {
  return prisma.storeOrder.findMany({
    where: { brandId },
    include: {
      items: true,
      transaction: {
        include: {
          creator: { select: { displayName: true } },
          commission: true,
          enrollment: {
            include: {
              offer: { select: { defaultCommissionPercent: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/// La marca confirma (o ajusta) la fecha/hora de una reserva de servicio
/// ya pagada, y si es virtual deja el link de la videollamada — el
/// comprador se entera por correo (no tiene cuenta en Marcolini, así que
/// no hay notificación dentro de la plataforma para él) y también lo ve si
/// vuelve a su página de confirmación del pedido.
export async function confirmServiceBooking(
  brandId: string,
  data: { orderId: string; itemId: string; confirmedAt: string; meetingInfo?: string | null },
) {
  const item = await prisma.storeOrderItem.findFirst({
    where: { id: data.itemId, orderId: data.orderId, order: { brandId } },
    include: { order: { include: { brand: true } } },
  });
  if (!item) throw new StoreOrderError("Reserva no encontrada.");
  if (item.order.status !== "PAID") {
    throw new StoreOrderError("Solo se pueden confirmar reservas ya pagadas.");
  }

  const confirmedAt = new Date(data.confirmedAt);
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new StoreOrderError("Fecha y hora inválidas.");
  }

  const updated = await prisma.storeOrderItem.update({
    where: { id: item.id },
    data: { serviceConfirmedAt: confirmedAt, serviceMeetingInfo: data.meetingInfo?.trim() || null },
  });

  await sendServiceBookingConfirmedEmail(item.order.buyerEmail, {
    companyName: item.order.brand.companyName,
    serviceName: item.name,
    confirmedAt: confirmedAt.toLocaleString("es-CO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Bogota",
    }),
    meetingInfo: updated.serviceMeetingInfo,
  });

  return updated;
}

/// Idempotente — puede llamarse desde el webhook y desde el respaldo por
/// consulta directa a la API de Wompi sin duplicar nada: si el pedido ya
/// no está PENDING, no vuelve a procesarlo.
export async function applyWompiTransactionStatus(params: {
  reference: string;
  wompiTransactionId: string;
  wompiStatus: string;
}) {
  const order = await prisma.storeOrder.findUnique({
    where: { reference: params.reference },
  });
  if (!order) return { order: null };
  if (order.status !== "PENDING") return { order };

  if (params.wompiStatus === "APPROVED") {
    const updated = await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        wompiTransactionId: params.wompiTransactionId,
        wompiStatus: params.wompiStatus,
        paidAt: new Date(),
      },
    });

    if (order.discountCode) {
      try {
        const result = await recordOrderFromWebhook({
          brandId: order.brandId,
          source: "MARCOLINI",
          externalOrderId: order.id,
          discountCode: order.discountCode,
          grossAmount: order.subtotalCents / 100,
          discountAmount: order.discountCents / 100,
          netAmount: (order.subtotalCents - order.discountCents) / 100,
          occurredAt: updated.paidAt ?? new Date(),
          customerEmail: order.buyerEmail,
        });
        if (result.transaction) {
          await prisma.storeOrder.update({
            where: { id: order.id },
            data: { transactionId: result.transaction.id },
          });
        }
      } catch (err) {
        // No revertimos el pago — ya se cobró de verdad — solo dejamos
        // evidencia; la marca/admin puede revisar y atribuir a mano si
        // hace falta.
        console.error(
          `[mi-tienda] No se pudo atribuir el pedido ${order.id} al código "${order.discountCode}":`,
          err,
        );
      }
    }

    return { order: updated };
  }

  // DECLINED / VOIDED / ERROR
  const updated = await prisma.storeOrder.update({
    where: { id: order.id },
    data: {
      status: "FAILED",
      wompiTransactionId: params.wompiTransactionId,
      wompiStatus: params.wompiStatus,
    },
  });
  return { order: updated };
}
