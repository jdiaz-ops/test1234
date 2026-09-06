import { prisma } from "@/lib/prisma";

export type CreatorScoreResult = {
  /// null = "Nuevo — sin historial" (nunca vendió) — nunca 0, para no
  /// confundir "sin datos" con "mal desempeño".
  score: number | null;
  netAmount90d: number;
  netAmountTotal: number;
  totalTransactions: number;
  refundedTransactions: number;
  hasSaleLast30Days: boolean;
  hasSaleLast90Days: boolean;
  hasConfirmedFraud: boolean;
};

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/// FraudFlag.transactionId es un id suelto, sin relación real en el schema
/// (varios detectores no tienen Transaction real detrás) — para saber qué
/// creador tiene flags confirmados hay que cruzar contra Transaction a
/// mano.
async function getConfirmedFraudCreatorIds(creatorIds: string[]) {
  const flags = await prisma.fraudFlag.findMany({
    where: { status: "CONFIRMED_FRAUD", transactionId: { not: null } },
    select: { transactionId: true },
  });
  const transactionIds = flags
    .map((f) => f.transactionId)
    .filter((id): id is string => id !== null);
  if (transactionIds.length === 0) return new Set<string>();

  const txns = await prisma.transaction.findMany({
    where: {
      id: { in: transactionIds },
      creatorId: { in: creatorIds },
    },
    select: { creatorId: true },
  });
  return new Set(txns.map((t) => t.creatorId));
}

/// Creator Score (0-100), calculado en una sola pasada para un grupo de
/// creadores — pensado para el buscador, que necesita el score de muchos a
/// la vez, no uno por uno.
///
/// Fórmula (punto de partida, pesos ajustables con datos reales de uso —
/// ver conversación del 2026-09-06):
///   ventasScore        (60%) = min(100, log10(netAmount90d + 1) × 16.67)
///   confiabilidadScore (25%) = 100 − (reembolsos / total transacciones × 100)
///   actividadScore     (15%) = vendió en 30d ? 100 : (vendió en 90d ? 50 : 0)
///   score = round(ventasScore×0.6 + confiabilidadScore×0.25 + actividadScore×0.15)
/// Si tiene algún FraudFlag CONFIRMED_FRAUD, el score se fuerza a 0 sin
/// importar lo demás.
export async function computeCreatorScores(
  creatorIds: string[],
): Promise<Map<string, CreatorScoreResult>> {
  const results = new Map<string, CreatorScoreResult>();
  if (creatorIds.length === 0) return results;

  const since90 = daysAgo(90);
  const since30 = daysAgo(30);

  const [transactions, fraudCreatorIds] = await Promise.all([
    prisma.transaction.findMany({
      where: { creatorId: { in: creatorIds } },
      select: {
        creatorId: true,
        netAmount: true,
        status: true,
        occurredAt: true,
      },
    }),
    getConfirmedFraudCreatorIds(creatorIds),
  ]);

  const byCreator = new Map<string, typeof transactions>();
  for (const t of transactions) {
    const list = byCreator.get(t.creatorId) ?? [];
    list.push(t);
    byCreator.set(t.creatorId, list);
  }

  for (const creatorId of creatorIds) {
    const list = byCreator.get(creatorId) ?? [];
    const hasConfirmedFraud = fraudCreatorIds.has(creatorId);

    if (list.length === 0) {
      results.set(creatorId, {
        score: null,
        netAmount90d: 0,
        netAmountTotal: 0,
        totalTransactions: 0,
        refundedTransactions: 0,
        hasSaleLast30Days: false,
        hasSaleLast90Days: false,
        hasConfirmedFraud,
      });
      continue;
    }

    const netAmountTotal = list.reduce(
      (sum, t) => sum + Number(t.netAmount),
      0,
    );
    const netAmount90d = list
      .filter((t) => t.occurredAt >= since90)
      .reduce((sum, t) => sum + Number(t.netAmount), 0);
    const refundedTransactions = list.filter(
      (t) => t.status === "REFUNDED",
    ).length;
    const hasSaleLast30Days = list.some(
      (t) => t.occurredAt >= since30 && t.status !== "REFUNDED",
    );
    const hasSaleLast90Days = list.some(
      (t) => t.occurredAt >= since90 && t.status !== "REFUNDED",
    );

    const ventasScore = Math.min(100, Math.log10(netAmount90d + 1) * 16.67);
    const confiabilidadScore = 100 - (refundedTransactions / list.length) * 100;
    const actividadScore = hasSaleLast30Days ? 100 : hasSaleLast90Days ? 50 : 0;

    const rawScore =
      ventasScore * 0.6 + confiabilidadScore * 0.25 + actividadScore * 0.15;
    const score = hasConfirmedFraud ? 0 : Math.round(rawScore);

    results.set(creatorId, {
      score,
      netAmount90d,
      netAmountTotal,
      totalTransactions: list.length,
      refundedTransactions,
      hasSaleLast30Days,
      hasSaleLast90Days,
      hasConfirmedFraud,
    });
  }

  return results;
}
