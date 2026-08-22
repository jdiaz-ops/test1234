import { prisma } from "@/lib/prisma";
import { provisionDiscountCodeForEnrollment } from "@/server/services/attribution-service";
import { awardWelcomeBonusIfEligible } from "@/server/services/challenge-service";
import { normalizeDiscountCode } from "@/lib/creator-identity";

export class MarketplaceError extends Error {}

/// El código de descuento solo tiene que ser único DENTRO de una marca — es
/// ahí donde de verdad choca (misma tienda de Shopify/WooCommerce), nunca
/// entre marcas distintas. Por eso se revisan solo las inscripciones de esa
/// marca, no todas las de la plataforma. Se incluyen PENDING_APPROVAL además
/// de ACTIVE para no dejar que dos solicitudes en cola se pisen el código
/// antes de que la marca las revise.
async function isDiscountCodeTakenInBrand(brandId: string, code: string) {
  const clash = await prisma.creatorOfferEnrollment.findFirst({
    where: {
      offer: { brandId },
      status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
      discountCode: { equals: code, mode: "insensitive" },
    },
  });
  return Boolean(clash);
}

export async function listActiveOffers(filters: { categorySlug?: string; search?: string }) {
  return prisma.offer.findMany({
    where: {
      status: "ACTIVE",
      // Además de aprobada, la marca debe haber terminado su onboarding
      // (perfil, tienda, método de pago) — ver getBrandOnboardingStatus en
      // onboarding-service.ts, que usa exactamente estas mismas condiciones.
      brand: {
        status: "APPROVED",
        // logoUrl/description/websiteUrl se guardan como "" (no null) cuando
        // el campo está vacío — por eso se excluyen ambos valores.
        NOT: [
          { logoUrl: null },
          { logoUrl: "" },
          { description: null },
          { description: "" },
          { websiteUrl: null },
          { websiteUrl: "" },
        ],
        storeConnectionStatus: "CONNECTED",
        cardTokenRef: { not: null },
      },
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

/// Une al creador a una oferta. El código de descuento para ESA marca lo
/// elige el creador al unirse (o se sugiere su baseCode si no da uno) — cada
/// marca tiene su propio código, porque cada una es una tienda separada con
/// sus propias reglas y cupones ya existentes. Si la oferta es OPEN (queda
/// ACTIVE al toque) el Motor de Atribución intenta crear ese código de
/// verdad en la tienda de la marca. Si es APPROVAL, eso se dispara recién
/// cuando la marca aprueba (ver enrollment-management-service).
export async function joinOffer(creatorId: string, offerId: string, desiredCode?: string) {
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

  const normalized = normalizeDiscountCode(desiredCode || creator.baseCode);
  if (!normalized) {
    throw new MarketplaceError("Ingresa un código válido.");
  }
  if (await isDiscountCodeTakenInBrand(offer.brandId, normalized)) {
    throw new MarketplaceError("Ese código ya está en uso en esta marca — elige otro.");
  }

  const enrollment = await prisma.creatorOfferEnrollment.create({
    data: {
      creatorId,
      offerId,
      status: offer.joinMode === "OPEN" ? "ACTIVE" : "PENDING_APPROVAL",
      discountCode: normalized,
    },
  });

  if (enrollment.status === "ACTIVE") {
    await provisionDiscountCodeForEnrollment(enrollment.id);
    await awardWelcomeBonusIfEligible(offerId, creatorId);
  }

  return enrollment;
}
