import { prisma } from "@/lib/prisma";

export async function listBrands(status?: string) {
  return prisma.brandProfile.findMany({
    where: status ? { status: status as never } : {},
    include: { vertical: true, _count: { select: { offers: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBrand(brandId: string) {
  return prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    include: { user: true, vertical: true, offers: true },
  });
}

export async function approveBrand(brandId: string) {
  const brand = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      userId: brand.userId,
      type: "brand_approved",
      message: "¡Tu marca fue aprobada! Ya apareces activa en el marketplace.",
    },
  });
  return brand;
}

export async function rejectBrand(brandId: string) {
  const brand = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { status: "REJECTED" },
  });
  await prisma.notification.create({
    data: {
      userId: brand.userId,
      type: "brand_rejected",
      message: "Tu marca no fue aprobada esta vez.",
    },
  });
  return brand;
}

export async function pauseBrand(brandId: string) {
  return prisma.brandProfile.update({ where: { id: brandId }, data: { status: "PAUSED" } });
}

export async function reactivateBrand(brandId: string) {
  return prisma.brandProfile.update({ where: { id: brandId }, data: { status: "APPROVED" } });
}

export async function setBrandFeeOverride(brandId: string, feePercent: number | null) {
  const brand = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { platformFeePercentOverride: feePercent },
  });
  await prisma.notification.create({
    data: {
      userId: brand.userId,
      type: "fee_changed",
      message: feePercent
        ? `Tu tarifa de plataforma cambió a ${feePercent}%.`
        : "Tu tarifa de plataforma volvió al valor por defecto.",
    },
  });
  return brand;
}
