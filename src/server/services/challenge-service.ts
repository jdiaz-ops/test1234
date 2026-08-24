import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { sendChallengeUrgencyEmail } from "@/lib/email";

export class ChallengeError extends Error {}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ----------------------------------------------------------------------------
// CRUD de retos (Portal Marca)
// ----------------------------------------------------------------------------

export async function listChallengesForOffer(offerId: string) {
  return prisma.challenge.findMany({
    where: { offerId },
    include: { rewards: { include: { creator: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listChallengesForBrand(brandId: string) {
  return prisma.challenge.findMany({
    where: { offer: { brandId } },
    include: { offer: true, rewards: { include: { creator: true } } },
    orderBy: { createdAt: "desc" },
  });
}

type ChallengeConfig =
  | { type: "GOAL_BONUS"; goalAmount: number; bonusAmount: number }
  | { type: "TEMP_COMMISSION_BOOST"; newCommissionPercent: number }
  | { type: "LEADERBOARD"; winnersCount: number; prizes: number[] }
  | { type: "WELCOME_BONUS"; slotsCount: number; bonusPerSlot: number }
  | { type: "CONTENT_CHALLENGE"; instructions: string; bonusAmount: number };

export async function createChallenge(
  brandId: string,
  data: { offerId: string; name: string; startDate: Date; endDate: Date; config: ChallengeConfig }
) {
  const offer = await prisma.offer.findFirst({ where: { id: data.offerId, brandId } });
  if (!offer) throw new ChallengeError("Oferta no encontrada.");
  if (data.endDate <= data.startDate) throw new ChallengeError("La fecha de fin debe ser después del inicio.");

  const { type, ...config } = data.config;

  return prisma.challenge.create({
    data: {
      offerId: data.offerId,
      name: data.name,
      type,
      startDate: data.startDate,
      endDate: data.endDate,
      config: config as Prisma.InputJsonValue,
    },
  });
}

export async function endChallenge(brandId: string, challengeId: string) {
  const challenge = await prisma.challenge.findFirst({ where: { id: challengeId, offer: { brandId } } });
  if (!challenge) throw new ChallengeError("Campaña no encontrada.");
  await prisma.challenge.update({ where: { id: challengeId }, data: { status: "ENDED" } });
  if (challenge.type === "LEADERBOARD") {
    await closeLeaderboardChallenge(challenge.id);
  }
}

// ----------------------------------------------------------------------------
// GOAL_BONUS — se revisa cada vez que a ese creador le entra una venta nueva
// en esa oferta.
// ----------------------------------------------------------------------------

async function grantReward(
  challengeId: string,
  creatorId: string,
  amount: number,
  holdDays: number,
  skipHold = false
) {
  // @@unique([challengeId, creatorId]) hace esto naturalmente idempotente —
  // un creador nunca puede ganar dos veces el mismo reto.
  const existing = await prisma.challengeReward.findUnique({
    where: { challengeId_creatorId: { challengeId, creatorId } },
  });
  if (existing) return existing;

  const reward = await prisma.challengeReward.create({
    data: {
      challengeId,
      creatorId,
      amount: new Prisma.Decimal(amount),
      status: skipHold ? "APPROVED" : "PENDING",
      holdUntil: skipHold ? null : addDays(new Date(), holdDays),
      approvedAt: skipHold ? new Date() : null,
    },
  });

  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });
  await createNotification(creator.userId, "CHALLENGE_REWARD", {
    monto: formatCOP(amount),
    detalle: skipHold ? "Ya está aprobado para tu próximo pago." : "Queda en espera por reembolsos, como cualquier venta.",
  });

  return reward;
}

/// Se llama después de registrar una Transaction nueva — revisa si esa
/// venta hizo que el creador cruce la meta de algún GOAL_BONUS activo de
/// esa oferta.
export async function checkGoalBonusProgress(offerId: string, creatorId: string) {
  const challenges = await prisma.challenge.findMany({
    where: { offerId, type: "GOAL_BONUS", status: "ACTIVE" },
  });
  if (challenges.length === 0) return;

  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });

  for (const challenge of challenges) {
    const now = new Date();
    if (now < challenge.startDate || now > challenge.endDate) continue;

    const cfg = challenge.config as { goalAmount: number; bonusAmount: number };

    const sum = await prisma.transaction.aggregate({
      where: {
        offerId,
        creatorId,
        status: { not: "REFUNDED" },
        occurredAt: { gte: challenge.startDate, lte: challenge.endDate },
      },
      _sum: { netAmount: true },
    });
    const totalSales = Number(sum._sum.netAmount ?? 0);

    if (totalSales >= cfg.goalAmount) {
      await grantReward(challenge.id, creatorId, cfg.bonusAmount, config.refundHoldDays);
    }
  }
}

/// Cuánto lleva vendido un creador hacia cada GOAL_BONUS activo de una
/// oferta en la que está inscrito — para mostrarle su progreso.
export async function getGoalBonusProgress(offerId: string, creatorId: string) {
  const challenges = await prisma.challenge.findMany({
    where: { offerId, type: "GOAL_BONUS", status: "ACTIVE" },
  });

  const progress = [];
  for (const challenge of challenges) {
    const cfg = challenge.config as { goalAmount: number; bonusAmount: number };
    const sum = await prisma.transaction.aggregate({
      where: {
        offerId,
        creatorId,
        status: { not: "REFUNDED" },
        occurredAt: { gte: challenge.startDate, lte: challenge.endDate },
      },
      _sum: { netAmount: true },
    });
    progress.push({
      challenge,
      currentAmount: Number(sum._sum.netAmount ?? 0),
      goalAmount: cfg.goalAmount,
      bonusAmount: cfg.bonusAmount,
    });
  }
  return progress;
}

// ----------------------------------------------------------------------------
// TEMP_COMMISSION_BOOST — lo consulta el Motor de Comisiones al calcular
// cada venta, no crea ChallengeReward propios.
// ----------------------------------------------------------------------------

/// Si hay un TEMP_COMMISSION_BOOST activo para esa oferta cubriendo la
/// fecha de la venta, devuelve el % elevado; si no, null (se usa el % normal).
export async function getActiveCommissionBoost(offerId: string, occurredAt: Date): Promise<number | null> {
  const boost = await prisma.challenge.findFirst({
    where: {
      offerId,
      type: "TEMP_COMMISSION_BOOST",
      status: "ACTIVE",
      startDate: { lte: occurredAt },
      endDate: { gte: occurredAt },
    },
  });
  if (!boost) return null;
  const cfg = boost.config as { newCommissionPercent: number };
  return cfg.newCommissionPercent;
}

// ----------------------------------------------------------------------------
// WELCOME_BONUS — se revisa al unirse a la oferta.
// ----------------------------------------------------------------------------

/// Se llama justo después de que una inscripción queda ACTIVE — si hay
/// cupos de bienvenida disponibles, se lo lleva de una (sin espera: unirse
/// no se puede "reembolsar").
export async function awardWelcomeBonusIfEligible(offerId: string, creatorId: string) {
  const challenges = await prisma.challenge.findMany({
    where: { offerId, type: "WELCOME_BONUS", status: "ACTIVE" },
  });

  for (const challenge of challenges) {
    const now = new Date();
    if (now < challenge.startDate || now > challenge.endDate) continue;

    const cfg = challenge.config as { slotsCount: number; bonusPerSlot: number };
    const claimedCount = await prisma.challengeReward.count({ where: { challengeId: challenge.id } });
    if (claimedCount >= cfg.slotsCount) continue;

    await grantReward(challenge.id, creatorId, cfg.bonusPerSlot, 0, true);
  }
}

// ----------------------------------------------------------------------------
// LEADERBOARD — se cierra cuando termina (endDate ya pasó).
// ----------------------------------------------------------------------------

async function closeLeaderboardChallenge(challengeId: string) {
  const challenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  const cfg = challenge.config as { winnersCount: number; prizes: number[] };
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });

  const ranking = await prisma.transaction.groupBy({
    by: ["creatorId"],
    where: {
      offerId: challenge.offerId,
      status: { not: "REFUNDED" },
      occurredAt: { gte: challenge.startDate, lte: challenge.endDate },
    },
    _sum: { netAmount: true },
    orderBy: { _sum: { netAmount: "desc" } },
    take: cfg.winnersCount,
  });

  for (let i = 0; i < ranking.length; i++) {
    const prize = cfg.prizes[i];
    if (!prize) continue;
    await grantReward(challenge.id, ranking[i].creatorId, prize, config.refundHoldDays);
  }

  if (challenge.status !== "ENDED") {
    await prisma.challenge.update({ where: { id: challengeId }, data: { status: "ENDED" } });
  }
}

/// Cierra todos los leaderboards cuya fecha de fin ya pasó y todavía no se
/// premiaron — se corre junto con el resto de las tareas diarias.
export async function closeEndedLeaderboards() {
  const ended = await prisma.challenge.findMany({
    where: { type: "LEADERBOARD", status: "ACTIVE", endDate: { lte: new Date() } },
  });
  for (const challenge of ended) {
    await closeLeaderboardChallenge(challenge.id);
  }
  return { closedCount: ended.length };
}

// ----------------------------------------------------------------------------
// CONTENT_CHALLENGE — el creador manda evidencia, la marca la revisa.
// ----------------------------------------------------------------------------

export async function submitContentChallenge(
  creatorId: string,
  challengeId: string,
  submission: { submissionUrl: string; submissionNote?: string }
) {
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, type: "CONTENT_CHALLENGE", status: "ACTIVE" },
  });
  if (!challenge) throw new ChallengeError("Campaña no encontrada o ya no está activa.");

  const enrollment = await prisma.creatorOfferEnrollment.findFirst({
    where: { creatorId, offerId: challenge.offerId, status: "ACTIVE" },
  });
  if (!enrollment) throw new ChallengeError("Debes estar vinculado a esa marca para participar.");

  const existing = await prisma.challengeReward.findUnique({
    where: { challengeId_creatorId: { challengeId, creatorId } },
  });
  if (existing) throw new ChallengeError("Ya enviaste tu participación en esta campaña.");

  const cfg = challenge.config as { instructions: string; bonusAmount: number };

  return prisma.challengeReward.create({
    data: {
      challengeId,
      creatorId,
      amount: new Prisma.Decimal(cfg.bonusAmount),
      status: "PENDING_REVIEW",
      submissionUrl: submission.submissionUrl,
      submissionNote: submission.submissionNote,
    },
  });
}

export async function reviewContentSubmission(
  brandId: string,
  rewardId: string,
  brandUserId: string,
  decision: "APPROVE" | "REJECT"
) {
  const reward = await prisma.challengeReward.findFirst({
    where: { id: rewardId, challenge: { offer: { brandId } }, status: "PENDING_REVIEW" },
    include: { challenge: true },
  });
  if (!reward) throw new ChallengeError("Participación no encontrada.");

  if (decision === "REJECT") {
    const rejected = await prisma.challengeReward.update({
      where: { id: reward.id },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: brandUserId },
    });
    const rejectedCreator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: reward.creatorId } });
    await createNotification(rejectedCreator.userId, "CHALLENGE_CONTENT_REJECTED", { reto: reward.challenge.name });
    return rejected;
  }

  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const updated = await prisma.challengeReward.update({
    where: { id: reward.id },
    data: {
      status: "PENDING",
      reviewedAt: new Date(),
      reviewedById: brandUserId,
      holdUntil: addDays(new Date(), config.refundHoldDays),
    },
  });

  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: reward.creatorId } });
  await createNotification(creator.userId, "CHALLENGE_REWARD_APPROVED", {
    reto: reward.challenge.name,
    monto: formatCOP(Number(reward.amount)),
  });

  return updated;
}

export async function listSubmissionsForBrand(brandId: string) {
  return prisma.challengeReward.findMany({
    where: { challenge: { offer: { brandId }, type: "CONTENT_CHALLENGE" }, status: "PENDING_REVIEW" },
    include: { challenge: true, creator: true },
    orderBy: { createdAt: "asc" },
  });
}

// ----------------------------------------------------------------------------
// Espera de 15 días — hermana de approveEligibleCommissions (Motor de
// Comisiones), pero para premios de retos.
// ----------------------------------------------------------------------------

export async function approveEligibleChallengeRewards() {
  const eligible = await prisma.challengeReward.findMany({
    where: { status: "PENDING", holdUntil: { lte: new Date() } },
  });
  if (eligible.length === 0) return { approvedCount: 0 };

  await prisma.challengeReward.updateMany({
    where: { id: { in: eligible.map((r) => r.id) } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  return { approvedCount: eligible.length };
}

export async function listRewardsForCreator(creatorId: string) {
  return prisma.challengeReward.findMany({
    where: { creatorId },
    include: { challenge: { include: { offer: { include: { brand: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

/// Retos activos de las marcas a las que el creador está vinculado — con su
/// propio progreso/participación ya resuelto para no tener que consultar de
/// nuevo desde la UI.
export async function listActiveChallengesForCreator(creatorId: string) {
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { creatorId, status: "ACTIVE" },
    select: { offerId: true },
  });
  const offerIds = enrollments.map((e) => e.offerId);
  if (offerIds.length === 0) return [];

  const challenges = await prisma.challenge.findMany({
    where: { offerId: { in: offerIds }, status: "ACTIVE" },
    include: { offer: { include: { brand: true } }, rewards: { where: { creatorId } } },
    orderBy: { endDate: "asc" },
  });

  const result = [];
  for (const challenge of challenges) {
    const myReward = challenge.rewards[0] ?? null;

    if (challenge.type === "GOAL_BONUS") {
      const cfg = challenge.config as { goalAmount: number; bonusAmount: number };
      const sum = await prisma.transaction.aggregate({
        where: {
          offerId: challenge.offerId,
          creatorId,
          status: { not: "REFUNDED" },
          occurredAt: { gte: challenge.startDate, lte: challenge.endDate },
        },
        _sum: { netAmount: true },
      });
      result.push({
        challenge,
        myReward,
        progress: { currentAmount: Number(sum._sum.netAmount ?? 0), goalAmount: cfg.goalAmount, bonusAmount: cfg.bonusAmount },
      });
    } else {
      result.push({ challenge, myReward, progress: null });
    }
  }
  return result;
}

/// Recordatorio de urgencia para retos activos por cerrar — a los 3 días y
/// al 1 día antes de endDate. Solo le llega a un creador con enrollment
/// ACTIVE en la oferta del reto que todavía no tiene ningún ChallengeReward
/// para él (si ya tiene uno, ya ganó o ya le rechazaron una evidencia — no
/// hace falta apurarlo). Cada combinación (reto, creador, ventana) se manda
/// una sola vez, sin importar cuántas veces corra el cron ese día — ver
/// ChallengeUrgencyPing.
export async function sendChallengeUrgencyReminders() {
  const now = new Date();
  const in3Days = addDays(now, 3);

  const challenges = await prisma.challenge.findMany({
    where: { status: "ACTIVE", endDate: { gt: now, lte: in3Days } },
  });

  let sentCount = 0;
  for (const challenge of challenges) {
    const daysRemaining = Math.ceil((challenge.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const window = daysRemaining <= 1 ? "1d" : "3d";
    const daysLabel = window === "1d" ? "1 día" : "3 días";

    const enrollments = await prisma.creatorOfferEnrollment.findMany({
      where: { offerId: challenge.offerId, status: "ACTIVE" },
      include: { creator: { include: { user: true } } },
    });

    for (const enrollment of enrollments) {
      const creatorId = enrollment.creatorId;

      const alreadyEngaged = await prisma.challengeReward.findFirst({ where: { challengeId: challenge.id, creatorId } });
      if (alreadyEngaged) continue;

      const alreadyPinged = await prisma.challengeUrgencyPing.findUnique({
        where: { challengeId_creatorId_window: { challengeId: challenge.id, creatorId, window } },
      });
      if (alreadyPinged) continue;

      let progressText = "";
      if (challenge.type === "GOAL_BONUS") {
        const cfg = challenge.config as { goalAmount: number; bonusAmount: number };
        const sum = await prisma.transaction.aggregate({
          where: {
            offerId: challenge.offerId,
            creatorId,
            status: { not: "REFUNDED" },
            occurredAt: { gte: challenge.startDate, lte: challenge.endDate },
          },
          _sum: { netAmount: true },
        });
        const current = Number(sum._sum.netAmount ?? 0);
        const remaining = Math.max(cfg.goalAmount - current, 0);
        progressText =
          remaining > 0
            ? ` Te faltan ${formatCOP(remaining)} para la meta y ganar ${formatCOP(cfg.bonusAmount)}.`
            : ` ¡Ya llegaste a la meta! Se confirma en cuanto termine la campaña.`;
      }

      await createNotification(
        enrollment.creator.userId,
        "CHALLENGE_URGENCY",
        { dias: daysLabel, reto: challenge.name, progreso: progressText },
        () =>
          sendChallengeUrgencyEmail(enrollment.creator.user.email, {
            displayName: enrollment.creator.displayName,
            challengeName: challenge.name,
            daysLabel,
            progressText,
          })
      );

      await prisma.challengeUrgencyPing.create({ data: { challengeId: challenge.id, creatorId, window } });
      sentCount++;
    }
  }
  return { sentCount };
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}
