import { prisma } from "@/lib/prisma";

export async function getGlobalDashboardSummary() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [gmv, commissionSums, newBrands, newCreators, brandCount, creatorCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { status: { not: "REFUNDED" } },
      _sum: { netAmount: true },
    }),
    prisma.commission.aggregate({
      where: { status: { in: ["APPROVED", "PAID"] } },
      _sum: { creatorCommissionAmount: true, platformFeeAmount: true, platformFeeVatAmount: true },
    }),
    prisma.brandProfile.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.creatorProfile.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.brandProfile.count({ where: { status: "APPROVED" } }),
    prisma.creatorProfile.count(),
  ]);

  const platformRevenue =
    Number(commissionSums._sum.platformFeeAmount ?? 0) + Number(commissionSums._sum.platformFeeVatAmount ?? 0);

  return {
    gmv: Number(gmv._sum.netAmount ?? 0),
    commissionPaidToCreators: Number(commissionSums._sum.creatorCommissionAmount ?? 0),
    platformRevenue,
    newBrandsThisMonth: newBrands,
    newCreatorsThisMonth: newCreators,
    activeBrandCount: brandCount,
    creatorCount,
  };
}

/// Panel de Rentabilidad: ingreso automático (tarifa de plataforma) vs.
/// costos que el admin ingresa manualmente mes a mes.
export async function getProfitabilityByMonth(monthsBack = 6) {
  const months: { month: Date; label: string }[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d, label: d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }) });
  }

  // Cada fila de MonthlyOperatingCost es un gasto puntual, no el total del
  // mes — se agrupan acá para el total, y se devuelven también sueltas
  // (costEntries) para que el panel pueda listar "en qué se fue la plata".
  const costEntries = await prisma.monthlyOperatingCost.findMany({
    where: { month: { gte: months[0].month } },
    orderBy: { createdAt: "desc" },
  });

  const rows = await Promise.all(
    months.map(async ({ month, label }) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const revenue = await prisma.commission.aggregate({
        where: {
          status: { in: ["APPROVED", "PAID"] },
          createdAt: { gte: month, lt: nextMonth },
        },
        _sum: { platformFeeAmount: true, platformFeeVatAmount: true },
      });
      const income =
        Number(revenue._sum.platformFeeAmount ?? 0) + Number(revenue._sum.platformFeeVatAmount ?? 0);
      const entriesThisMonth = costEntries.filter((c) => c.month.getTime() === month.getTime());
      const cost = entriesThisMonth.reduce((sum, c) => sum + Number(c.amount), 0);
      return {
        label,
        month: month.toISOString(),
        income,
        cost,
        hasCostEntry: entriesThisMonth.length > 0,
        costEntries: entriesThisMonth.map((c) => ({ id: c.id, label: c.label, amount: Number(c.amount) })),
      };
    })
  );

  return rows;
}

/// Registra UN gasto puntual del mes (ej. "Compra del dominio" $150.000) —
/// no sobreescribe ni acumula en un solo número: cada llamada crea una
/// fila nueva, y el total del mes sale de sumarlas todas (ver
/// getProfitabilityByMonth). Así el admin puede ver después en qué se fue
/// la plata, no solo el total.
export async function createMonthlyCostEntry(month: Date, label: string, amount: number) {
  const normalized = new Date(month.getFullYear(), month.getMonth(), 1);
  return prisma.monthlyOperatingCost.create({
    data: { month: normalized, label, amount },
  });
}

export async function deleteMonthlyCostEntry(id: string) {
  await prisma.monthlyOperatingCost.delete({ where: { id } });
}

/// Insight de mercado (solo para el admin, por ahora) — rangos de precio y
/// productos que más se compran, agregados de las transacciones reales.
export async function getMarketInsight() {
  const transactions = await prisma.transaction.findMany({
    where: { status: { not: "REFUNDED" } },
    include: { offer: { include: { brand: true } } },
  });

  const byBrand = new Map<string, { name: string; count: number; total: number; avg: number }>();
  for (const t of transactions) {
    const key = t.offer.brand.id;
    const current = byBrand.get(key) ?? { name: t.offer.brand.companyName, count: 0, total: 0, avg: 0 };
    current.count += 1;
    current.total += Number(t.netAmount);
    byBrand.set(key, current);
  }
  const brandStats = Array.from(byBrand.values())
    .map((b) => ({ ...b, avg: b.total / b.count }))
    .sort((a, b) => b.total - a.total);

  return { brandStats, hasData: transactions.length > 0 };
}
