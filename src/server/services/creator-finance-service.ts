import { prisma } from "@/lib/prisma";

/// Primer día de pago (payoutDayOfMonth) que cae en o después de `from`.
export function payoutDateOnOrAfter(from: Date, dayOfMonth: number) {
  const candidate = new Date(from.getFullYear(), from.getMonth(), dayOfMonth);
  if (candidate < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}

/// Resumen para el Dashboard del creador. Muestra lo confirmado (aprobado
/// o pagado) y también lo que sigue en los días de espera por devoluciones
/// — antes solo lo confirmado, y una creadora que acababa de recibir
/// "ganaste $432" entraba y veía $0 (2026-10-04).
export async function getCreatorDashboardSummary(creatorId: string) {
  const [approved, pending, paidThisYear, config, transactions] = await Promise.all([
    prisma.commission.aggregate({
      where: { transaction: { creatorId }, status: "APPROVED" },
      _sum: { creatorCommissionAmount: true },
    }),
    prisma.commission.findMany({
      where: { transaction: { creatorId, status: "COMPLETED" }, status: "PENDING" },
      select: { creatorCommissionAmount: true, holdUntil: true },
      orderBy: { holdUntil: "asc" },
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
    // Top marcas por comisión generada (también la que sigue en espera) —
    // se agrupa en memoria porque agrupar por una relación anidada
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

  const approvedTotal = Number(approved._sum.creatorCommissionAmount ?? 0);
  const pendingTotal = pending.reduce((sum, c) => sum + Number(c.creatorCommissionAmount), 0);
  const nextPayout = payoutDateOnOrAfter(new Date(), config.payoutDayOfMonth);
  // Lo que entra al próximo pago: lo ya aprobado más lo que termina la
  // espera antes de ese día (el cron aprueba y paga el mismo día, en ese
  // orden; se cuenta solo lo que vence antes de que empiece el día, para
  // no prometer de más).
  const nextPayoutAmount =
    approvedTotal +
    pending.filter((c) => c.holdUntil && c.holdUntil < nextPayout).reduce((sum, c) => sum + Number(c.creatorCommissionAmount), 0);
  const firstPendingConfirm = pending[0]?.holdUntil ?? null;

  return {
    approvedPendingPayout: approvedTotal,
    pendingTotal,
    pendingConfirmsAt: firstPendingConfirm,
    // Si lo que está en espera no alcanza el próximo pago, en qué pago cae.
    pendingPayoutDate:
      firstPendingConfirm && firstPendingConfirm >= nextPayout
        ? payoutDateOnOrAfter(
            new Date(firstPendingConfirm.getFullYear(), firstPendingConfirm.getMonth(), firstPendingConfirm.getDate() + 1),
            config.payoutDayOfMonth,
          )
        : null,
    nextPayout,
    nextPayoutAmount,
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
