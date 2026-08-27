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

  const costs = await prisma.monthlyOperatingCost.findMany({
    where: { month: { gte: months[0].month } },
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
      const cost = costs.find((c) => c.month.getTime() === month.getTime());
      return {
        label,
        month: month.toISOString(),
        income,
        cost: cost ? Number(cost.amount) : 0,
        hasCostEntry: !!cost,
      };
    })
  );

  return rows;
}

/// Suma `amountToAdd` al costo ya registrado del mes (o lo crea si es el
/// primer gasto del mes) — antes esto SOBREESCRIBÍA el monto, obligando al
/// admin a ir sumando los gastos a mano y siempre cargar la cifra ya
/// acumulada. Ahora cada gasto que registra se acumula solo.
export async function addMonthlyCost(month: Date, amountToAdd: number, note?: string) {
  const normalized = new Date(month.getFullYear(), month.getMonth(), 1);
  return prisma.monthlyOperatingCost.upsert({
    where: { month: normalized },
    update: { amount: { increment: amountToAdd }, ...(note ? { note } : {}) },
    create: { month: normalized, amount: amountToAdd, note },
  });
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
