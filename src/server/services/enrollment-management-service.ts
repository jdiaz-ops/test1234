import { prisma } from "@/lib/prisma";
import { provisionDiscountCodeForEnrollment } from "@/server/services/attribution-service";
import { awardWelcomeBonusIfEligible } from "@/server/services/challenge-service";

export class EnrollmentManagementError extends Error {}

/// Trae los creadores vinculados a las ofertas de una marca, cada uno con
/// sus números (transacciones, órdenes, ingreso generado) para que la marca
/// vea rápido quién le está funcionando mejor — ordenados de mayor a menor
/// ingreso generado por defecto.
export async function listEnrollmentsForBrand(brandId: string) {
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { offer: { brandId } },
    include: { creator: true, offer: true },
  });

  const stats = await prisma.transaction.groupBy({
    by: ["enrollmentId"],
    where: { offer: { brandId }, status: { not: "REFUNDED" } },
    _count: { _all: true },
    _sum: { netAmount: true },
  });
  const statsByEnrollment = new Map(
    stats.map((s) => [s.enrollmentId, { orders: s._count._all, revenue: Number(s._sum.netAmount ?? 0) }])
  );

  return enrollments
    .map((e) => {
      const s = statsByEnrollment.get(e.id) ?? { orders: 0, revenue: 0 };
      return { ...e, orderCount: s.orders, transactionCount: s.orders, revenue: s.revenue };
    })
    .sort((a, b) => b.revenue - a.revenue);
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
  const enrollment = await prisma.creatorOfferEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "ACTIVE" },
  });
  await provisionDiscountCodeForEnrollment(enrollment.id);
  await awardWelcomeBonusIfEligible(enrollment.offerId, enrollment.creatorId);
  return enrollment;
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
