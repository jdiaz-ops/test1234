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

type CartItemInput = { productId: string; quantity: number };

type CreateOrderInput = {
  items: CartItemInput[];
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingNotes?: string | null;
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
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotalCents = 0;
  const itemsData: {
    productId: string;
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
    if (product.stock != null && product.stock < item.quantity) {
      throw new StoreOrderError(
        `No hay suficiente stock de "${product.name}".`,
      );
    }
    const unitPriceCents = Math.round(Number(product.price) * 100);
    subtotalCents += unitPriceCents * item.quantity;
    itemsData.push({
      productId: product.id,
      name: product.name,
      unitPriceCents,
      quantity: item.quantity,
      imageUrl: product.imageUrl,
    });
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
  const freeThresholdCents = brand.freeShippingThreshold
    ? Math.round(Number(brand.freeShippingThreshold) * 100)
    : null;
  const flatRateCents = brand.shippingFlatRate
    ? Math.round(Number(brand.shippingFlatRate) * 100)
    : 0;
  const shippingCents =
    freeThresholdCents != null && afterDiscount >= freeThresholdCents
      ? 0
      : flatRateCents;

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
        shippingAddress: input.shippingAddress.trim(),
        shippingCity: input.shippingCity.trim(),
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
