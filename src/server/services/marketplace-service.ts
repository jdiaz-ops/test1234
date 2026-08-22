import { prisma } from "@/lib/prisma";

export class MarketplaceError extends Error {}

export async function listActiveOffers(filters: { categorySlug?: string; search?: string }) {
  return prisma.offer.findMany({
    where: {
      status: "ACTIVE",
      brand: { status: "APPROVED" },
      ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { brand: { companyName: { contains: filters.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { brand: true, category: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEnrollmentsForCreator(creatorId: string) {
  return prisma.creatorOfferEnrollment.findMany({
    where: { creatorId },
    include: { offer: { include: { brand: true } } },
  });
}

/// Une al creador a una oferta. La creación del código real en la tienda de
/// la marca (Shopify/WooCommerce) la hace el Motor de Atribución — por ahora
/// el código queda registrado como el baseCode del creador, listo para que
/// esa integración lo tome cuando esté construida.
export async function joinOffer(creatorId: string, offerId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { brand: true },
  });

  if (!offer || offer.status !== "ACTIVE" || offer.brand.status !== "APPROVED") {
    throw new MarketplaceError("Esta oferta ya no está disponible.");
  }

  const existing = await prisma.creatorOfferEnrollment.findUnique({
    where: { offerId_creatorId: { offerId, creatorId } },
  });
  if (existing) {
    throw new MarketplaceError("Ya estás unido a esta oferta.");
  }

  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });

  return prisma.creatorOfferEnrollment.create({
    data: {
      creatorId,
      offerId,
      status: offer.joinMode === "OPEN" ? "ACTIVE" : "PENDING_APPROVAL",
      discountCode: creator.baseCode,
    },
  });
}
