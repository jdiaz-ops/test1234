import { prisma } from "@/lib/prisma";

/// Estado del Motor de Comisiones — cuántas comisiones hay en cada etapa y
/// cuánto suman, para que el admin vea de un vistazo si algo se está
/// acumulando sin moverse (ej. muchas PENDING vencidas esperando el próximo
/// ciclo del Motor de Pagos).
export async function getCommissionsSummary() {
  const [pending, approved, paid, reversed] = await Promise.all([
    prisma.commission.aggregate({ where: { status: "PENDING" }, _count: true, _sum: { creatorCommissionAmount: true } }),
    prisma.commission.aggregate({ where: { status: "APPROVED" }, _count: true, _sum: { creatorCommissionAmount: true } }),
    prisma.commission.aggregate({ where: { status: "PAID" }, _count: true, _sum: { creatorCommissionAmount: true } }),
    prisma.commission.aggregate({ where: { status: "REVERSED" }, _count: true, _sum: { creatorCommissionAmount: true } }),
  ]);
  const [eligibleCommissions, eligibleRewards] = await Promise.all([
    prisma.commission.count({ where: { status: "PENDING", holdUntil: { lte: new Date() } } }),
    prisma.challengeReward.count({ where: { status: "PENDING", holdUntil: { lte: new Date() } } }),
  ]);

  return {
    pending: { count: pending._count, amount: Number(pending._sum.creatorCommissionAmount ?? 0) },
    approved: { count: approved._count, amount: Number(approved._sum.creatorCommissionAmount ?? 0) },
    paid: { count: paid._count, amount: Number(paid._sum.creatorCommissionAmount ?? 0) },
    reversed: { count: reversed._count, amount: Number(reversed._sum.creatorCommissionAmount ?? 0) },
    eligibleNow: eligibleCommissions + eligibleRewards,
  };
}

/// Igual que getCommissionsSummary, pero para premios de retos — dinero
/// aparte de las ventas normales.
export async function getChallengeRewardsSummary() {
  const [pendingReview, pending, approved, paid, rejected] = await Promise.all([
    prisma.challengeReward.aggregate({ where: { status: "PENDING_REVIEW" }, _count: true, _sum: { amount: true } }),
    prisma.challengeReward.aggregate({ where: { status: "PENDING" }, _count: true, _sum: { amount: true } }),
    prisma.challengeReward.aggregate({ where: { status: "APPROVED" }, _count: true, _sum: { amount: true } }),
    prisma.challengeReward.aggregate({ where: { status: "PAID" }, _count: true, _sum: { amount: true } }),
    prisma.challengeReward.aggregate({ where: { status: "REJECTED" }, _count: true, _sum: { amount: true } }),
  ]);

  return {
    pendingReview: { count: pendingReview._count, amount: Number(pendingReview._sum.amount ?? 0) },
    pending: { count: pending._count, amount: Number(pending._sum.amount ?? 0) },
    approved: { count: approved._count, amount: Number(approved._sum.amount ?? 0) },
    paid: { count: paid._count, amount: Number(paid._sum.amount ?? 0) },
    rejected: { count: rejected._count, amount: Number(rejected._sum.amount ?? 0) },
  };
}

export async function listAllTransactions() {
  return prisma.transaction.findMany({
    include: { creator: true, offer: { include: { brand: true } }, commission: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}

export async function listBrandCharges() {
  return prisma.brandCharge.findMany({
    include: { brand: true },
    orderBy: { periodStart: "desc" },
    take: 100,
  });
}

export async function listPayouts() {
  return prisma.payout.findMany({
    include: { creator: true },
    orderBy: { periodStart: "desc" },
    take: 100,
  });
}

export async function listInstantPayoutRequests() {
  return prisma.instantPayoutRequest.findMany({
    include: { creator: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listStoreHealth() {
  return prisma.brandProfile.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      companyName: true,
      storeType: true,
      storeUrl: true,
      storeConnectionStatus: true,
      storeLastSyncedAt: true,
    },
    orderBy: { companyName: "asc" },
  });
}
