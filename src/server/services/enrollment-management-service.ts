import { prisma } from "@/lib/prisma";

export class EnrollmentManagementError extends Error {}

export async function listEnrollmentsForBrand(brandId: string) {
  return prisma.creatorOfferEnrollment.findMany({
    where: { offer: { brandId } },
    include: { creator: true, offer: true },
    orderBy: { joinedAt: "desc" },
  });
}

async function assertBelongsToBrand(enrollmentId: string, brandId: string) {
  const enrollment = await prisma.creatorOfferEnrollment.findFirst({
    where: { id: enrollmentId, offer: { brandId } },
  });
  if (!enrollment) throw new EnrollmentManagementError("Creador no encontrado.");
  return enrollment;
}

export async function approveEnrollment(brandId: string, enrollmentId: string) {
  await assertBelongsToBrand(enrollmentId, brandId);
  return prisma.creatorOfferEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "ACTIVE" },
  });
}

export async function rejectEnrollment(brandId: string, enrollmentId: string) {
  await assertBelongsToBrand(enrollmentId, brandId);
  return prisma.creatorOfferEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "REJECTED" },
  });
}

export async function setEnrollmentOverrides(
  brandId: string,
  enrollmentId: string,
  data: { commissionPercentOverride: number | null; discountPercentOverride: number | null }
) {
  await assertBelongsToBrand(enrollmentId, brandId);
  return prisma.creatorOfferEnrollment.update({
    where: { id: enrollmentId },
    data,
  });
}
