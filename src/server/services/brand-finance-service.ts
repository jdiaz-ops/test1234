import { prisma } from "@/lib/prisma";

export async function getBrandDashboardSummary(brandId: string) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [gmv, orders, commissionPaid, newCreatorsThisMonth, config, brand] = await Promise.all([
    prisma.transaction.aggregate({
      where: { offer: { brandId }, status: { not: "REFUNDED" } },
      _sum: { netAmount: true },
    }),
    prisma.transaction.count({
      where: { offer: { brandId }, status: { not: "REFUNDED" } },
    }),
    prisma.commission.aggregate({
      where: { transaction: { offer: { brandId } }, status: { in: ["APPROVED", "PAID"] } },
      _sum: { creatorCommissionAmount: true, platformFeeAmount: true, platformFeeVatAmount: true },
    }),
    prisma.creatorOfferEnrollment.count({
      where: { offer: { brandId }, joinedAt: { gte: startOfMonth } },
    }),
    prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } }),
    prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } }),
  ]);

  const effectiveFeePercent = brand.platformFeePercentOverride
    ? Number(brand.platformFeePercentOverride)
    : Number(config.defaultPlatformFeePercent);

  return {
    gmv: Number(gmv._sum.netAmount ?? 0),
    orderCount: orders,
    transactionCount: orders,
    commissionPaidToCreators: Number(commissionPaid._sum.creatorCommissionAmount ?? 0),
    platformFeePaid:
      Number(commissionPaid._sum.platformFeeAmount ?? 0) +
      Number(commissionPaid._sum.platformFeeVatAmount ?? 0),
    newCreatorsThisMonth,
    platformFeePercent: effectiveFeePercent,
    vatPercent: Number(config.vatPercent),
  };
}

export async function getBrandTransactions(brandId: string) {
  return prisma.transaction.findMany({
    where: { offer: { brandId } },
    include: { creator: true, offer: true, commission: true },
    orderBy: { occurredAt: "desc" },
  });
}
