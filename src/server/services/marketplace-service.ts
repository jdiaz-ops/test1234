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

export async function listActiveOffers(filters: { categorySlug?: string; search?: string; verticalIds?: string[] }) {
  return prisma.offer.findMany({
    where: {
      status: "ACTIVE",
      brand: {
        // FORCE_HIDDEN gana siempre (ej. para ocultar una marca a medio
        // conectar mientras se prueba otra cosa), y FORCE_VISIBLE se salta
        // por completo los requisitos reales de onboarding — pensado para
        // que Juan pueda probar el flujo del marketplace con marcas de
        // prueba sin tener que llenarles perfil, conectar tienda, etc. Ver
        // MarketplaceVisibilityOverride en el schema.
        marketplaceVisibilityOverride: { not: "FORCE_HIDDEN" },
        OR: [
          { marketplaceVisibilityOverride: "FORCE_VISIBLE" },
          {
            // Comportamiento real: además de aprobada, la marca debe haber
            // terminado su onboarding (perfil, tienda, cómo-te-cobramos) —
            // ver getBrandOnboardingStatus en onboarding-service.ts, que usa
            // exactamente estas mismas condiciones — y no estar bloqueada
            // por falta de pago verificado (ver isBrandPaymentLocked en
            // payment-service.ts).
            status: "APPROVED",
            // logoUrl/description/websiteUrl se guardan como "" (no null)
            // cuando el campo está vacío — por eso se excluyen ambos valores.
            NOT: [
              { logoUrl: null },
              { logoUrl: "" },
              { description: null },
              { description: "" },
              { websiteUrl: null },
              { websiteUrl: "" },
            ],
            storeConnectionStatus: "CONNECTED",
            billingAcknowledgedAt: { not: null },
            // Igual que isBrandPaymentLocked en payment-service.ts: bloqueada
            // si hay un corte sin pagar cuyo plazo ya venció (no depende de
            // que el cron ya haya puesto el status en OVERDUE).
            charges: { none: { status: { not: "PAID" }, dueAt: { lt: new Date() } } },
          },
        ],
        // Filtro opcional del wizard de onboarding de creador — ofertas de
        // marcas en las categorías que le interesan, para no mostrarle las
        // 200 de una (ver src/components/portal/creator-join-brands-step.tsx).
        // Aplica siempre, sin importar el override de visibilidad.
        ...(filters.verticalIds && filters.verticalIds.length > 0
          ? { verticalId: { in: filters.verticalIds } }
          : {}),
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

  // offerId_creatorId es único — un creador que se retiró (ver leaveOffer)
  // conserva su fila en REMOVED/REJECTED, así que "unirse de nuevo" es
  // reactivar esa misma fila, no crear una segunda.
  const existing = await prisma.creatorOfferEnrollment.findUnique({
    where: { offerId_creatorId: { offerId, creatorId } },
  });
  if (existing && (existing.status === "ACTIVE" || existing.status === "PENDING_APPROVAL")) {
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

  const status: "ACTIVE" | "PENDING_APPROVAL" = offer.joinMode === "OPEN" ? "ACTIVE" : "PENDING_APPROVAL";
  const data = { status, discountCode: normalized };
  const enrollment = existing
    ? await prisma.creatorOfferEnrollment.update({ where: { id: existing.id }, data })
    : await prisma.creatorOfferEnrollment.create({ data: { creatorId, offerId, ...data } });

  if (enrollment.status === "ACTIVE") {
    await provisionDiscountCodeForEnrollment(enrollment.id);
    await awardWelcomeBonusIfEligible(offerId, creatorId);
  }

  return enrollment;
}

/// El creador se retira de un programa al que ya se había unido — libera su
/// fila (queda en REMOVED, no se borra) para que pueda volver a unirse más
/// adelante si quiere. No revoca el código en la tienda real de la marca
/// (Shopify/WooCommerce) — solo dejamos de contarlo como activo de nuestro
/// lado; si hace falta desactivarlo también allá, es trabajo futuro.
export async function leaveOffer(creatorId: string, enrollmentId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findFirst({
    where: { id: enrollmentId, creatorId },
  });
  if (!enrollment) {
    throw new MarketplaceError("No encontramos esa inscripción.");
  }
  if (enrollment.status !== "ACTIVE" && enrollment.status !== "PENDING_APPROVAL") {
    throw new MarketplaceError("Ya no estás en este programa.");
  }
  return prisma.creatorOfferEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "REMOVED" },
  });
}
