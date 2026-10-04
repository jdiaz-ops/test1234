import { prisma } from "@/lib/prisma";
import { bogotaDate, bogotaMidnight, nextPayoutDate, payoutDateForSale } from "@/lib/payout-calendar";

/// Resumen para el Dashboard del creador, con el cierre por mes (ver
/// lib/payout-calendar.ts): lo que lleva vendido este mes y cuándo se le
/// paga, cuánto recibe en el próximo pago y lo ya pagado en el año.
export async function getCreatorDashboardSummary(creatorId: string) {
  const now = new Date();
  const today = bogotaDate(now);
  const monthStart = bogotaMidnight(today.year, today.month, 1);
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const nextPayout = nextPayoutDate(now, config.payoutDayOfMonth);

  const [thisMonth, approved, pendingDue, paidThisYear, transactions] = await Promise.all([
    prisma.commission.aggregate({
      where: { transaction: { creatorId, occurredAt: { gte: monthStart } }, status: { not: "REVERSED" } },
      _sum: { creatorCommissionAmount: true },
    }),
    prisma.commission.aggregate({
      where: { transaction: { creatorId }, status: "APPROVED" },
      _sum: { creatorCommissionAmount: true },
    }),
    // Las que el cron aprueba el mismo día de pago, antes de pagar.
    prisma.commission.aggregate({
      where: { transaction: { creatorId, status: "COMPLETED" }, status: "PENDING", holdUntil: { lte: nextPayout } },
      _sum: { creatorCommissionAmount: true },
    }),
    prisma.commission.aggregate({
      where: {
        transaction: { creatorId },
        status: "PAID",
        approvedAt: { gte: bogotaMidnight(today.year, 0, 1) },
      },
      _sum: { creatorCommissionAmount: true },
    }),
    // Top marcas por comisión generada (también la que todavía no se
    // paga) — se agrupa en memoria porque agrupar por una relación anidada
    // (offer.brand) no lo soporta groupBy.
    prisma.transaction.findMany({
      where: { creatorId, commission: { status: { in: ["PENDING", "APPROVED", "PAID"] } } },
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
    monthStart,
    thisMonthTotal: Number(thisMonth._sum.creatorCommissionAmount ?? 0),
    // Cuándo se paga lo que se venda hoy (el último día del mes da el mismo
    // pago, salvo que no alcance los días de espera).
    thisMonthPayout: payoutDateForSale(now, config.payoutDayOfMonth, config.refundHoldDays),
    nextPayout,
    nextPayoutAmount:
      Number(approved._sum.creatorCommissionAmount ?? 0) + Number(pendingDue._sum.creatorCommissionAmount ?? 0),
    // Las ventas que entran al próximo pago son las del mes anterior a él.
    nextPayoutSalesMonth: (() => {
      const p = bogotaDate(nextPayout);
      return bogotaMidnight(p.year, p.month - 1, 1);
    })(),
    paidThisYear: Number(paidThisYear._sum.creatorCommissionAmount ?? 0),
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
