import { prisma } from "@/lib/prisma";
import type { CreatorProfile } from "@prisma/client";
import { createNotification } from "@/server/services/notification-service";
import { sendBadgeEarnedEmail } from "@/lib/email";
import { getCreatorOnboardingStatus } from "@/server/services/creator-onboarding-service";
import { CREATOR_BADGE_CATALOG, getBadgeDef } from "@/lib/creator-badges";

const THRESHOLDS = {
  diezVentas: 10,
  millonComisiones: 1_000_000,
  multimarca: 3,
};

async function getCreatorBadgeStats(profile: CreatorProfile) {
  const [onboarding, activeEnrollmentCount, salesCount, commissionSum, paidPayoutCount, challengeWinCount] =
    await Promise.all([
      getCreatorOnboardingStatus(profile),
      prisma.creatorOfferEnrollment.count({ where: { creatorId: profile.id, status: "ACTIVE" } }),
      prisma.commission.count({ where: { status: { not: "REVERSED" }, transaction: { creatorId: profile.id } } }),
      prisma.commission.aggregate({
        where: { status: { not: "REVERSED" }, transaction: { creatorId: profile.id } },
        _sum: { creatorCommissionAmount: true },
      }),
      prisma.payout.count({ where: { creatorId: profile.id, status: "PAID" } }),
      prisma.challengeReward.count({ where: { creatorId: profile.id, status: { in: ["APPROVED", "PAID"] } } }),
    ]);

  return {
    onboardingComplete: onboarding.complete,
    activeEnrollmentCount,
    salesCount,
    commissionSum: Number(commissionSum._sum.creatorCommissionAmount ?? 0),
    paidPayoutCount,
    challengeWinCount,
  };
}

function earnedKeysFromStats(stats: Awaited<ReturnType<typeof getCreatorBadgeStats>>): string[] {
  const keys: string[] = [];
  if (stats.onboardingComplete) keys.push("perfil_completo");
  if (stats.activeEnrollmentCount >= 1) keys.push("primera_marca");
  if (stats.activeEnrollmentCount >= THRESHOLDS.multimarca) keys.push("multimarca");
  if (stats.salesCount >= 1) keys.push("primera_venta");
  if (stats.salesCount >= THRESHOLDS.diezVentas) keys.push("diez_ventas");
  if (stats.commissionSum >= THRESHOLDS.millonComisiones) keys.push("millon_comisiones");
  if (stats.paidPayoutCount >= 1) keys.push("primer_pago");
  if (stats.challengeWinCount >= 1) keys.push("ganador_reto");
  return keys;
}

/// Corre dentro del cron diario (ver /api/cron/pagos-diarios) — revisa cada
/// creador activo contra el catálogo de insignias y otorga (una sola vez,
/// nunca se retira aunque después baje de actividad) las que ya cumple y
/// todavía no tiene. Avisa por notificación + correo cada vez que se otorga
/// una insignia nueva.
export async function evaluateCreatorBadges() {
  const profiles = await prisma.creatorProfile.findMany({
    where: { suspended: false },
    include: { user: true },
  });

  let awardedCount = 0;
  for (const profile of profiles) {
    const stats = await getCreatorBadgeStats(profile);
    const earnedKeys = earnedKeysFromStats(stats);
    if (earnedKeys.length === 0) continue;

    const existing = await prisma.creatorBadge.findMany({
      where: { creatorId: profile.id, badgeKey: { in: earnedKeys } },
      select: { badgeKey: true },
    });
    const existingKeys = new Set(existing.map((b) => b.badgeKey));
    const newKeys = earnedKeys.filter((k) => !existingKeys.has(k));

    for (const key of newKeys) {
      const def = getBadgeDef(key);
      if (!def) continue;

      await prisma.creatorBadge.create({ data: { creatorId: profile.id, badgeKey: key } });
      await createNotification(profile.userId, "BADGE_EARNED", `¡Nueva insignia! ${def.label} — ${def.description}`);
      await sendBadgeEarnedEmail(profile.user.email, {
        displayName: profile.displayName,
        label: def.label,
        description: def.description,
      });
      awardedCount++;
    }
  }
  return { awardedCount };
}

/// Para el dashboard del creador: insignias ya ganadas, más una pista de la
/// insignia numérica más cercana a desbloquear (la que tenga mejor % de
/// avance) — solo se sugiere una a la vez para no saturar.
export async function getCreatorBadgeBoard(profile: CreatorProfile) {
  const [earned, stats] = await Promise.all([
    prisma.creatorBadge.findMany({ where: { creatorId: profile.id }, orderBy: { earnedAt: "asc" } }),
    getCreatorBadgeStats(profile),
  ]);

  const earnedKeys = new Set(earned.map((b) => b.badgeKey));
  const earnedBadges = earned.map((b) => getBadgeDef(b.badgeKey)).filter((d): d is NonNullable<typeof d> => Boolean(d));

  const numericTargets = [
    { key: "primera_venta", current: stats.salesCount, goal: 1 },
    { key: "diez_ventas", current: stats.salesCount, goal: THRESHOLDS.diezVentas },
    { key: "millon_comisiones", current: stats.commissionSum, goal: THRESHOLDS.millonComisiones },
    { key: "multimarca", current: stats.activeEnrollmentCount, goal: THRESHOLDS.multimarca },
  ].filter((t) => !earnedKeys.has(t.key) && t.current < t.goal);

  let nextHint: { badge: (typeof CREATOR_BADGE_CATALOG)[number]; current: number; goal: number } | null = null;
  if (numericTargets.length > 0) {
    const closest = numericTargets.reduce((best, t) => (t.current / t.goal > best.current / best.goal ? t : best));
    const def = getBadgeDef(closest.key);
    if (def) nextHint = { badge: def, current: closest.current, goal: closest.goal };
  }

  return { earnedBadges, nextHint, totalCount: CREATOR_BADGE_CATALOG.length };
}
