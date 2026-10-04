import { prisma } from "@/lib/prisma";

export async function getBrandDashboardSummary(brandId: string) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [gmv, orders, commissionPaid, newCreatorsThisMonth, config, brand, monthSales, monthCommissions] = await Promise.all([
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
    // Lo de este mes (para el dashboard): ventas con creadoras y lo que
    // cuestan, aunque la comisión siga en los 15 días de espera — igual
    // entra al próximo corte (ver runBrandCharges). Antes el dashboard
    // decía "Este mes invertiste $0" con comisiones ya causadas, porque
    // solo contaba las aprobadas. Pedido del 2026-10-04.
    prisma.transaction.aggregate({
      where: { offer: { brandId }, status: { not: "REFUNDED" }, occurredAt: { gte: startOfMonth } },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.commission.aggregate({
      where: {
        transaction: { offer: { brandId }, occurredAt: { gte: startOfMonth } },
        status: { not: "REVERSED" },
      },
      _sum: { creatorCommissionAmount: true, platformFeeAmount: true, platformFeeVatAmount: true },
    }),
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
    monthSales: Number(monthSales._sum.netAmount ?? 0),
    monthOrders: monthSales._count,
    monthCreatorCommissions: Number(monthCommissions._sum.creatorCommissionAmount ?? 0),
    monthPlatformFee:
      Number(monthCommissions._sum.platformFeeAmount ?? 0) + Number(monthCommissions._sum.platformFeeVatAmount ?? 0),
    chargeDayOfMonth: config.chargeDayOfMonth,
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

/// Los N creadores que más ingresos le generaron a la marca — para el
/// dashboard, mostrarle rápido "quién te está funcionando".
export async function getTopCreatorsForBrand(brandId: string, limit = 3) {
  const stats = await prisma.transaction.groupBy({
    by: ["creatorId"],
    where: { offer: { brandId }, status: { not: "REFUNDED" } },
    _count: { _all: true },
    _sum: { netAmount: true },
    orderBy: { _sum: { netAmount: "desc" } },
    take: limit,
  });
  if (stats.length === 0) return [];

  const creators = await prisma.creatorProfile.findMany({
    where: { id: { in: stats.map((s) => s.creatorId) } },
  });
  const creatorById = new Map(creators.map((c) => [c.id, c]));

  return stats
    .map((s) => {
      const creator = creatorById.get(s.creatorId);
      if (!creator) return null;
      return {
        id: creator.id,
        displayName: creator.displayName,
        photoUrl: creator.photoUrl,
        orderCount: s._count._all,
        revenue: Number(s._sum.netAmount ?? 0),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/// Cuántos creadores están esperando que la marca los apruebe — solo aplica
/// a ofertas configuradas como "por aprobación" (JoinMode.APPROVAL); en una
/// oferta abierta nadie queda pendiente, se unen directo.
export async function countPendingApprovalsForBrand(brandId: string) {
  return prisma.creatorOfferEnrollment.count({
    where: { offer: { brandId }, status: "PENDING_APPROVAL" },
  });
}
