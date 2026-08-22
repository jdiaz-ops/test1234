import { prisma } from "@/lib/prisma";

/// Resumen para el Dashboard del creador — solo montos CONFIRMADOS
/// (aprobados o pagados), nunca proyectados, tal como se definió.
export async function getCreatorDashboardSummary(creatorId: string) {
  const [approved, paidThisYear, config, transactions] = await Promise.all([
    prisma.commission.aggregate({
      where: { transaction: { creatorId }, status: "APPROVED" },
      _sum: { creatorCommissionAmount: true },
    }),
    prisma.commission.aggregate({
      where: {
        transaction: { creatorId },
        status: "PAID",
        approvedAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
      _sum: { creatorCommissionAmount: true },
    }),
    prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } }),
    // Top marcas por comisión generada — se agrupa en memoria porque
    // agrupar por una relación anidada (offer.brand) no lo soporta groupBy.
    prisma.transaction.findMany({
      where: { creatorId, commission: { status: { in: ["APPROVED", "PAID"] } } },
      include: { offer: { include: { brand: true } }, commission: true },
    }),
  ]);

  const byBrand = new Map<string, { name: string; total: number }>();
  for (const t of transactions) {
    const key = t.offer.brand.id;
    const current = byBrand.get(key) ?? { name: t.offer.brand.companyName, total: 0 };
    current.total += Number(t.commission?.creatorCommissionAmount ?? 0);
    byBrand.set(key, current);
  }
  const topBrandsList = Array.from(byBrand.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  return {
    approvedPendingPayout: Number(approved._sum.creatorCommissionAmount ?? 0),
    paidThisYear: Number(paidThisYear._sum.creatorCommissionAmount ?? 0),
    payoutDayOfMonth: config.payoutDayOfMonth,
    topBrands: topBrandsList,
  };
}

export async function getCreatorTransactions(creatorId: string) {
  return prisma.transaction.findMany({
    where: { creatorId },
    include: { offer: { include: { brand: true } }, commission: true },
    orderBy: { occurredAt: "desc" },
  });
}
