import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { isBrandServiceDeactivated } from "@/server/services/payment-service";

/// Muestras gratis (inspirado en TikTok Shop) — dos direcciones posibles:
/// - CREATOR pide (pull): la marca habilita un producto de su catálogo
///   (manual o sincronizado) con un pool de unidades solo para regalar, el
///   creador lo ve en su portal y lo pide con un clic.
/// - BRAND ofrece (push, reclutamiento desde el buscador de creadores): la
///   marca le ofrece la muestra a un creador puntual sin que él la haya
///   pedido; el creador solo acepta (pone sus datos de envío) o rechaza.
/// En ambos casos, si termina aprobada, se crea un StoreOrder $0 (kind
/// SAMPLE) con los datos de envío del creador — aparece en Mi tienda →
/// Pedidos igual que uno pagado.

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

/// PENDING/OFFERED primero (orden de declaración del enum en Postgres),
/// luego resueltas más recientes arriba.
export async function listBrandSampleRequests(brandId: string) {
  return prisma.sampleRequest.findMany({
    where: { brandId },
    include: { creator: true, product: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

/// Se llama tanto desde que la marca aprueba una solicitud que el creador
/// pidió, como desde que el creador acepta una oferta que la marca le
/// mandó — en ambos casos el resultado es el mismo: descontar el pool y
/// crear el pedido $0. Vuelve a chequear el stock por dentro de la
/// transacción (pudo cambiar desde que se creó la solicitud).
async function finalizeApprovedSample(requestId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.sampleRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { brand: true, product: true },
    });

    if (
      !request.shippingName ||
      !request.shippingPhone ||
      !request.shippingAddress ||
      !request.shippingCity
    ) {
      throw new SampleError("Faltan los datos de envío.");
    }

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

    const creator = await tx.creatorProfile.findUniqueOrThrow({
      where: { id: request.creatorId },
      include: { user: true },
    });

    const order = await tx.storeOrder.create({
      data: {
        brandId: request.brandId,
        kind: "SAMPLE",
        reference: `sample_${randomUUID()}`,
        buyerName: request.shippingName,
        buyerEmail: creator.user.email,
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

    return tx.sampleRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedAt: new Date(), orderId: order.id },
    });
  });
}

export async function respondToSampleRequest(
  brandId: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  rejectedReason?: string | null,
) {
  const request = await prisma.sampleRequest.findFirst({
    where: { id: requestId, brandId, initiatedBy: "CREATOR" },
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

  const updatedRequest = await finalizeApprovedSample(request.id);

  await createNotification(request.creator.user.id, "SAMPLE_APPROVED", {
    marca: request.brand.companyName,
    producto: request.product.name,
  });

  return updatedRequest;
}

/// La marca le ofrece proactivamente una muestra a un creador puntual —
/// encontrado en el buscador — sin que él la haya pedido. Reusa el mismo
/// SampleRequest, solo que arranca en OFFERED (no PENDING) y sin datos de
/// envío todavía — el creador los llena si acepta.
export async function offerSampleToCreator(
  brandId: string,
  data: {
    creatorId: string;
    productId: string;
    quantity: number;
    message?: string | null;
  },
) {
  const product = await prisma.product.findFirst({
    where: { id: data.productId, brandId },
  });
  if (!product) throw new SampleError("Producto no encontrado.");
  if (!product.sampleEnabled || product.sampleStock < data.quantity) {
    throw new SampleError("No hay suficiente stock de muestras para ofrecer.");
  }

  const creator = await prisma.creatorProfile.findUnique({
    where: { id: data.creatorId },
  });
  if (!creator || !creator.discoverable || creator.suspended) {
    throw new SampleError("Ese creador no está disponible.");
  }

  const existing = await prisma.sampleRequest.findFirst({
    where: {
      creatorId: data.creatorId,
      productId: product.id,
      status: { in: ["PENDING", "OFFERED"] },
    },
  });
  if (existing) {
    throw new SampleError(
      "Ya hay una solicitud/oferta abierta con este creador para este producto.",
    );
  }

  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
  });

  const request = await prisma.sampleRequest.create({
    data: {
      brandId,
      creatorId: data.creatorId,
      productId: product.id,
      quantity: data.quantity,
      message: data.message || null,
      initiatedBy: "BRAND",
      status: "OFFERED",
    },
  });

  await createNotification(creator.userId, "SAMPLE_OFFERED", {
    marca: brand.companyName,
    producto: product.name,
  });

  return request;
}

/// Ofertas que la marca le mandó al creador y todavía esperan su respuesta.
export async function listCreatorSampleOffers(creatorId: string) {
  return prisma.sampleRequest.findMany({
    where: { creatorId, initiatedBy: "BRAND", status: "OFFERED" },
    include: { product: true, brand: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptSampleOffer(
  creatorId: string,
  requestId: string,
  shipping: {
    shippingName: string;
    shippingPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingNotes?: string | null;
  },
) {
  const request = await prisma.sampleRequest.findFirst({
    where: { id: requestId, creatorId, initiatedBy: "BRAND" },
    include: { product: true, brand: true },
  });
  if (!request) throw new SampleError("Oferta no encontrada.");
  if (request.status !== "OFFERED") {
    throw new SampleError("Esta oferta ya no está disponible.");
  }

  await prisma.sampleRequest.update({
    where: { id: request.id },
    data: {
      shippingName: shipping.shippingName,
      shippingPhone: shipping.shippingPhone,
      shippingAddress: shipping.shippingAddress,
      shippingCity: shipping.shippingCity,
      shippingNotes: shipping.shippingNotes || null,
    },
  });

  const updated = await finalizeApprovedSample(request.id);

  const brandUser = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: request.brandId },
    include: { user: true },
  });
  const creator = await prisma.creatorProfile.findUniqueOrThrow({
    where: { id: creatorId },
  });
  await createNotification(brandUser.user.id, "SAMPLE_OFFER_ACCEPTED", {
    creador: creator.displayName,
    producto: request.product.name,
  });

  return updated;
}

export async function declineSampleOffer(creatorId: string, requestId: string) {
  const request = await prisma.sampleRequest.findFirst({
    where: { id: requestId, creatorId, initiatedBy: "BRAND" },
  });
  if (!request) throw new SampleError("Oferta no encontrada.");
  if (request.status !== "OFFERED") {
    throw new SampleError("Esta oferta ya no está disponible.");
  }

  return prisma.sampleRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
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
    where: { creatorId, initiatedBy: "CREATOR" },
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
