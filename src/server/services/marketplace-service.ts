import { prisma } from "@/lib/prisma";
import { provisionDiscountCodeForEnrollment } from "@/server/services/attribution-service";

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

/// Une al creador a una oferta. El código del creador queda registrado de
/// inmediato (discountCode = su baseCode); si la oferta es OPEN (queda
/// ACTIVE al toque) el Motor de Atribución intenta crear ese código de
/// verdad en la tienda de la marca. Si es APPROVAL, eso se dispara recién
/// cuando la marca aprueba (ver enrollment-management-service).
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

  const enrollment = await prisma.creatorOfferEnrollment.create({
    data: {
      creatorId,
      offerId,
      status: offer.joinMode === "OPEN" ? "ACTIVE" : "PENDING_APPROVAL",
      discountCode: creator.baseCode,
    },
  });

  if (enrollment.status === "ACTIVE") {
    await provisionDiscountCodeForEnrollment(enrollment.id);
  }

  return enrollment;
}
