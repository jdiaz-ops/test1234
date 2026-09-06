import { prisma } from "@/lib/prisma";
import { normalizeDiscountCode } from "@/lib/creator-identity";
import { provisionDiscountCodeForEnrollment } from "@/server/services/attribution-service";
import { awardWelcomeBonusIfEligible } from "@/server/services/challenge-service";
import { createNotification } from "@/server/services/notification-service";
import { isBrandServiceDeactivated } from "@/server/services/payment-service";
import { isDiscountCodeTakenInBrand } from "@/server/services/marketplace-service";

/// Invitación directa de la marca a un creador (encontrado en el
/// buscador) para unirse a una oferta — el equivalente a "Target
/// Collaboration" de TikTok Shop. Salta el filtro normal de
/// JoinMode.APPROVAL: la marca ya está aprobando de entrada al invitar, así
/// que si el creador acepta, la vinculación queda ACTIVA de una vez.

export class RecruitError extends Error {}

export async function inviteCreatorToOffer(
  brandId: string,
  data: {
    offerId: string;
    creatorId: string;
    commissionPercentOverride?: number | null;
    discountPercentOverride?: number | null;
    message?: string | null;
  },
) {
  const offer = await prisma.offer.findFirst({
    where: { id: data.offerId, brandId },
    include: { brand: true },
  });
  if (!offer) throw new RecruitError("Oferta no encontrada.");
  if (offer.status !== "ACTIVE") {
    throw new RecruitError("Esta oferta no está activa.");
  }
  if (await isBrandServiceDeactivated(brandId)) {
    throw new RecruitError("Tu marca no está disponible por ahora.");
  }

  const creator = await prisma.creatorProfile.findUnique({
    where: { id: data.creatorId },
  });
  if (!creator || !creator.discoverable || creator.suspended) {
    throw new RecruitError("Ese creador no está disponible.");
  }

  const existingEnrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: {
      offerId_creatorId: { offerId: data.offerId, creatorId: data.creatorId },
    },
  });
  if (
    existingEnrollment &&
    (existingEnrollment.status === "ACTIVE" ||
      existingEnrollment.status === "PENDING_APPROVAL")
  ) {
    throw new RecruitError(
      "Este creador ya está vinculado (o tiene una solicitud pendiente) a esta oferta.",
    );
  }

  const existingInvitation = await prisma.enrollmentInvitation.findFirst({
    where: {
      offerId: data.offerId,
      creatorId: data.creatorId,
      status: "PENDING",
    },
  });
  if (existingInvitation) {
    throw new RecruitError(
      "Ya tienes una invitación pendiente con este creador.",
    );
  }

  const invitation = await prisma.enrollmentInvitation.create({
    data: {
      offerId: data.offerId,
      creatorId: data.creatorId,
      commissionPercentOverride: data.commissionPercentOverride ?? null,
      discountPercentOverride: data.discountPercentOverride ?? null,
      message: data.message || null,
    },
  });

  await createNotification(creator.userId, "ENROLLMENT_INVITED_CREATOR", {
    marca: offer.brand.companyName,
  });

  return invitation;
}

export async function listCreatorInvitations(creatorId: string) {
  return prisma.enrollmentInvitation.findMany({
    where: { creatorId, status: "PENDING" },
    include: { offer: { include: { brand: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function respondToInvitation(
  creatorId: string,
  invitationId: string,
  decision: "ACCEPT" | "DECLINE",
  desiredCode?: string,
) {
  const invitation = await prisma.enrollmentInvitation.findFirst({
    where: { id: invitationId, creatorId },
    include: { offer: { include: { brand: true } }, creator: true },
  });
  if (!invitation) throw new RecruitError("Invitación no encontrada.");
  if (invitation.status !== "PENDING") {
    throw new RecruitError("Esta invitación ya fue resuelta.");
  }

  if (decision === "DECLINE") {
    const updated = await prisma.enrollmentInvitation.update({
      where: { id: invitation.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await createNotification(
      invitation.offer.brand.userId,
      "ENROLLMENT_INVITATION_DECLINED",
      { creador: invitation.creator.displayName },
    );
    return updated;
  }

  // ACCEPT
  if (await isBrandServiceDeactivated(invitation.offer.brandId)) {
    throw new RecruitError("Esta marca ya no está disponible.");
  }

  const creator = await prisma.creatorProfile.findUniqueOrThrow({
    where: { id: creatorId },
  });
  const normalized = normalizeDiscountCode(desiredCode || creator.baseCode);
  if (!normalized) throw new RecruitError("Ingresa un código válido.");
  if (await isDiscountCodeTakenInBrand(invitation.offer.brandId, normalized)) {
    throw new RecruitError(
      "Ese código ya está en uso en esta marca — elige otro.",
    );
  }

  const existingEnrollment = await prisma.creatorOfferEnrollment.findUnique({
    where: {
      offerId_creatorId: { offerId: invitation.offerId, creatorId },
    },
  });

  const enrollment = existingEnrollment
    ? await prisma.creatorOfferEnrollment.update({
        where: { id: existingEnrollment.id },
        data: {
          status: "ACTIVE",
          discountCode: normalized,
          commissionPercentOverride: invitation.commissionPercentOverride,
          discountPercentOverride: invitation.discountPercentOverride,
        },
      })
    : await prisma.creatorOfferEnrollment.create({
        data: {
          creatorId,
          offerId: invitation.offerId,
          status: "ACTIVE",
          discountCode: normalized,
          commissionPercentOverride: invitation.commissionPercentOverride,
          discountPercentOverride: invitation.discountPercentOverride,
        },
      });

  await provisionDiscountCodeForEnrollment(enrollment.id);
  await awardWelcomeBonusIfEligible(invitation.offerId, creatorId);

  return prisma.enrollmentInvitation.update({
    where: { id: invitation.id },
    data: {
      status: "ACCEPTED",
      respondedAt: new Date(),
      enrollmentId: enrollment.id,
    },
  });
}
