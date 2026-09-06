import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { isBrandServiceDeactivated } from "@/server/services/payment-service";

/// Muestras gratis (inspirado en TikTok Shop) — la marca habilita cualquier
/// producto de su catálogo (manual o sincronizado) con un pool de unidades
/// solo para regalar; los creadores lo ven en su portal y piden una con un
/// clic; la marca acepta o rechaza; si acepta, se crea un StoreOrder $0
/// (kind SAMPLE) con los datos de envío que dio el creador — ese pedido
/// aparece en Mi tienda → Pedidos igual que uno pagado, para que la marca
/// gestione el despacho desde el mismo lugar.

export class SampleError extends Error {}

// ---------------------------------------------------------------- MARCA

export async function listBrandSampleCatalog(brandId: string) {
  return prisma.product.findMany({
    where: { brandId },
    orderBy: [{ sampleEnabled: "desc" }, { name: "asc" }],
  });
}

export async function updateProductSampleSettings(
  brandId: string,
  data: {
    productId: string;
    sampleEnabled: boolean;
    sampleStock: number;
    sampleContentType?: string | null;
    sampleInstructions?: string | null;
    sampleDeadlineDays?: number | null;
  },
) {
  const product = await prisma.product.findFirst({
    where: { id: data.productId, brandId },
  });
  if (!product) throw new SampleError("Producto no encontrado.");

  return prisma.product.update({
    where: { id: product.id },
    data: {
      sampleEnabled: data.sampleEnabled,
      sampleStock: data.sampleStock,
      sampleContentType: data.sampleContentType || null,
      sampleInstructions: data.sampleInstructions || null,
      sampleDeadlineDays: data.sampleDeadlineDays ?? null,
    },
  });
}

/// PENDING primero (orden de declaración del enum en Postgres), luego
/// resueltas más recientes arriba.
export async function listBrandSampleRequests(brandId: string) {
  return prisma.sampleRequest.findMany({
    where: { brandId },
    include: { creator: true, product: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function respondToSampleRequest(
  brandId: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  rejectedReason?: string | null,
) {
  const request = await prisma.sampleRequest.findFirst({
    where: { id: requestId, brandId },
    include: {
      product: true,
      brand: true,
      creator: { include: { user: true } },
    },
  });
  if (!request) throw new SampleError("Solicitud no encontrada.");
  if (request.status !== "PENDING") {
    throw new SampleError("Esta solicitud ya fue resuelta.");
  }

  if (decision === "REJECTED") {
    const updated = await prisma.sampleRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        rejectedReason: rejectedReason || null,
        reviewedAt: new Date(),
      },
    });
    await createNotification(request.creator.user.id, "SAMPLE_REJECTED", {
      marca: request.brand.companyName,
      producto: request.product.name,
      razon: rejectedReason ? ` Motivo: ${rejectedReason}` : "",
    });
    return updated;
  }

  // APPROVED — vuelve a chequear el stock por dentro de la transacción (pudo
  // cambiar entre que se pidió la muestra y que la marca decide) y crea el
  // pedido $0 atómicamente con el descuento del pool.
  const { request: updatedRequest } = await prisma.$transaction(async (tx) => {
    const freshProduct = await tx.product.findUniqueOrThrow({
      where: { id: request.productId },
    });
    if (
      !freshProduct.sampleEnabled ||
      freshProduct.sampleStock < request.quantity
    ) {
      throw new SampleError(
        "Ya no hay suficiente stock de muestras para este producto.",
      );
    }

    await tx.product.update({
      where: { id: freshProduct.id },
      data: { sampleStock: { decrement: request.quantity } },
    });

    const order = await tx.storeOrder.create({
      data: {
        brandId: request.brandId,
        kind: "SAMPLE",
        reference: `sample_${randomUUID()}`,
        buyerName: request.shippingName,
        buyerEmail: request.creator.user.email,
        buyerPhone: request.shippingPhone,
        shippingAddress: request.shippingAddress,
        shippingCity: request.shippingCity,
        shippingNotes: request.shippingNotes,
        subtotalCents: 0,
        discountCents: 0,
        shippingCents: 0,
        totalCents: 0,
        paymentMode: request.brand.paymentMode,
        status: "PAID",
        paidAt: new Date(),
        items: {
          create: [
            {
              productId: freshProduct.id,
              name: freshProduct.name,
              unitPriceCents: 0,
              quantity: request.quantity,
              imageUrl: freshProduct.imageUrl,
            },
          ],
        },
      },
    });

    const updated = await tx.sampleRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedAt: new Date(), orderId: order.id },
    });

    return { request: updated, order };
  });

  await createNotification(request.creator.user.id, "SAMPLE_APPROVED", {
    marca: request.brand.companyName,
    producto: request.product.name,
  });

  return updatedRequest;
}

// -------------------------------------------------------------- CREADOR

/// Igual criterio de visibilidad que la vitrina pública de un creador (ver
/// /c/[slug]/page.tsx): marca aprobada, no oculta a propósito, y no
/// desactivada por falta de pago (Nivel 3) — filtrado en dos pasos porque
/// el estado de Nivel 3 vive en BrandCharge, no en BrandProfile.
export async function listSampleEligibleProducts() {
  const products = await prisma.product.findMany({
    where: {
      sampleEnabled: true,
      sampleStock: { gt: 0 },
      available: true,
      brand: {
        status: "APPROVED",
        marketplaceVisibilityOverride: { not: "FORCE_HIDDEN" },
      },
    },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });

  const brandIds = [...new Set(products.map((p) => p.brandId))];
  const deactivated = await prisma.brandCharge.findMany({
    where: { status: "DEACTIVATED", brandId: { in: brandIds } },
    select: { brandId: true },
  });
  const deactivatedSet = new Set(deactivated.map((d) => d.brandId));

  return products.filter((p) => !deactivatedSet.has(p.brandId));
}

export async function listCreatorSampleRequests(creatorId: string) {
  return prisma.sampleRequest.findMany({
    where: { creatorId },
    include: { product: true, brand: true },
    orderBy: { createdAt: "desc" },
  });
}

type CreateSampleRequestInput = {
  productId: string;
  quantity: number;
  message?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingNotes?: string | null;
};

export async function createSampleRequest(
  creatorId: string,
  data: CreateSampleRequestInput,
) {
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
  });
  if (
    !product ||
    !product.sampleEnabled ||
    product.sampleStock < data.quantity
  ) {
    throw new SampleError("Esta muestra ya no está disponible.");
  }
  if (await isBrandServiceDeactivated(product.brandId)) {
    throw new SampleError("Esta marca no está disponible por ahora.");
  }

  const existing = await prisma.sampleRequest.findFirst({
    where: { creatorId, productId: product.id, status: "PENDING" },
  });
  if (existing) {
    throw new SampleError(
      "Ya tienes una solicitud pendiente para este producto.",
    );
  }

  const request = await prisma.sampleRequest.create({
    data: {
      brandId: product.brandId,
      creatorId,
      productId: product.id,
      quantity: data.quantity,
      message: data.message || null,
      shippingName: data.shippingName,
      shippingPhone: data.shippingPhone,
      shippingAddress: data.shippingAddress,
      shippingCity: data.shippingCity,
      shippingNotes: data.shippingNotes || null,
    },
  });

  const [creator, brand] = await Promise.all([
    prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } }),
    prisma.brandProfile.findUniqueOrThrow({
      where: { id: product.brandId },
      include: { user: true },
    }),
  ]);
  await createNotification(brand.user.id, "SAMPLE_REQUESTED", {
    creador: creator.displayName,
    producto: product.name,
  });

  return request;
}
