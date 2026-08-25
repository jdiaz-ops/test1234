import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { sendChallengeUrgencyEmail } from "@/lib/email";
import { setShopifyDiscountValue, ShopifyApiError } from "@/server/integrations/shopify-client";
import { setWooCommerceCouponValue, WooCommerceApiError } from "@/server/integrations/woocommerce-client";

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
  | { type: "FLASH_SALE"; newCommissionPercent?: number; newDiscountPercent?: number }
  | { type: "MIX"; goalAmount: number; bonusAmount: number; newCommissionPercent?: number; newDiscountPercent?: number }
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
  if (
    (data.config.type === "FLASH_SALE" || data.config.type === "MIX") &&
    data.config.newCommissionPercent == null &&
    data.config.newDiscountPercent == null
  ) {
    throw new ChallengeError("Sube la comisión, el descuento, o ambos.");
  }

  const { type, ...config } = data.config;

  const challenge = await prisma.challenge.create({
    data: {
      offerId: data.offerId,
      name: data.name,
      type,
      startDate: data.startDate,
      endDate: data.endDate,
      config: config as Prisma.InputJsonValue,
    },
  });

  // El lado de comisión no necesita nada más — se calcula al vuelo en cada
  // venta (ver getActiveCommissionBoost). El lado de descuento sí tiene que
  // tocar la tienda real, y si la campaña ya arranca hoy no puede esperar al
  // cron de mañana (una campaña relámpago de 48h no puede perder medio día
  // sin el descuento realmente activo en el checkout). applyDiscountBoost
  // no hace nada si esta campaña en particular no tocó el descuento.
  if ((type === "FLASH_SALE" || type === "MIX") && data.startDate <= new Date()) {
    await applyDiscountBoost(challenge);
  }

  // No hay opt-in para participar en una campaña — en cambio, se avisa a
  // todos los creadores vinculados a la oferta apenas arranca, para que
  // puedan adaptar su comunicación (ver notifyCreatorsCampaignStarted). Si
  // la campaña arranca en el futuro, esto lo cubre el cron diario
  // (notifyStartedCampaigns) cuando llegue esa fecha.
  if (data.startDate <= new Date()) {
    await notifyCreatorsCampaignStarted(challenge);
  }

  return challenge;
}

export async function endChallenge(brandId: string, challengeId: string) {
  const challenge = await prisma.challenge.findFirst({ where: { id: challengeId, offer: { brandId } } });
  if (!challenge) throw new ChallengeError("Campaña no encontrada.");
  await prisma.challenge.update({ where: { id: challengeId }, data: { status: "ENDED" } });
  if (challenge.type === "LEADERBOARD") {
    await closeLeaderboardChallenge(challenge.id);
  }
  // La marca terminó la campaña antes de tiempo — el descuento elevado
  // tiene que bajar ya, no esperar a que endDate llegue solo.
  if ((challenge.type === "FLASH_SALE" || challenge.type === "MIX") && challenge.discountBoostActive) {
    await revertDiscountBoost(challenge);
  }
}

// ----------------------------------------------------------------------------
// Aviso de campaña nueva — sin opt-in, se notifica a todos los creadores
// vinculados a la oferta apenas la campaña queda activa (ver createChallenge
// y notifyStartedCampaigns). Un solo aviso por campaña, no por creador que
// se una después — un creador que se vincula a mitad de una campaña ya
// activa la ve directamente en su panel de Campañas, no hace falta
// avisarle aparte.
// ----------------------------------------------------------------------------

/// El texto varía según qué trae la campaña — una Misión habla de meta y
/// bono, un Flash Sale de comisión y/o descuento, un Mix de lo que aplique
/// de las dos. Mismo criterio que configSummary en challenges-panel.tsx del
/// lado marca, pero en tono "esto es para ti" para el creador.
function campaignStartedDetail(type: string, cfg: Record<string, unknown>): string {
  const parts: string[] = [];
  if (type === "GOAL_BONUS" || type === "MIX") {
    parts.push(`Vende ${formatCOP(Number(cfg.goalAmount))} en el período y gana ${formatCOP(Number(cfg.bonusAmount))} de bono.`);
  }
  if (cfg.newCommissionPercent != null) parts.push(`Tu comisión sube a ${cfg.newCommissionPercent}%.`);
  if (cfg.newDiscountPercent != null) parts.push(`El descuento de tu código sube a ${cfg.newDiscountPercent}%.`);
  return parts.join(" ");
}

async function notifyCreatorsCampaignStarted(challenge: {
  id: string;
  offerId: string;
  name: string;
  type: string;
  config: Prisma.JsonValue;
  endDate: Date;
}) {
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: challenge.offerId }, include: { brand: true } });
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { offerId: challenge.offerId, status: "ACTIVE" },
    include: { creator: true },
  });

  const detalle = campaignStartedDetail(challenge.type, challenge.config as Record<string, unknown>);
  const fecha = challenge.endDate.toLocaleDateString("es-CO");

  for (const enrollment of enrollments) {
    await createNotification(enrollment.creator.userId, "CAMPAIGN_STARTED", {
      marca: offer.brand.companyName,
      campana: challenge.name,
      detalle,
      fecha,
    });
  }

  await prisma.challenge.update({ where: { id: challenge.id }, data: { startNotificationSent: true } });
}

/// Corre a diario junto con el resto de tareas del cron — avisa las
/// campañas cuya fecha de inicio ya llegó y todavía no se notificó a nadie
/// (la inmediata en createChallenge ya cubre el caso normal de "arranca
/// hoy"; esto es para las programadas a futuro).
export async function notifyStartedCampaigns() {
  const toNotify = await prisma.challenge.findMany({
    where: {
      type: { in: ["GOAL_BONUS", "FLASH_SALE", "MIX"] },
      status: "ACTIVE",
      startNotificationSent: false,
      startDate: { lte: new Date() },
    },
  });
  for (const challenge of toNotify) {
    await notifyCreatorsCampaignStarted(challenge);
  }
  return { notifiedCount: toNotify.length };
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
    where: { offerId, type: { in: ["GOAL_BONUS", "MIX"] }, status: "ACTIVE" },
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
    where: { offerId, type: { in: ["GOAL_BONUS", "MIX"] }, status: "ACTIVE" },
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
// FLASH_SALE / MIX — lado comisión: lo consulta el Motor de Comisiones al
// calcular cada venta, no crea ChallengeReward propios.
// ----------------------------------------------------------------------------

/// Si hay un FLASH_SALE o MIX activo para esa oferta cubriendo la fecha de
/// la venta Y con el lado de comisión configurado (es opcional — una
/// campaña puede subir solo el descuento y dejar la comisión intacta),
/// devuelve el % elevado; si no, null (se usa el % normal).
export async function getActiveCommissionBoost(offerId: string, occurredAt: Date): Promise<number | null> {
  const candidates = await prisma.challenge.findMany({
    where: {
      offerId,
      type: { in: ["FLASH_SALE", "MIX"] },
      status: "ACTIVE",
      startDate: { lte: occurredAt },
      endDate: { gte: occurredAt },
    },
  });
  for (const boost of candidates) {
    const cfg = boost.config as { newCommissionPercent?: number };
    if (cfg.newCommissionPercent != null) return cfg.newCommissionPercent;
  }
  return null;
}

// ----------------------------------------------------------------------------
// FLASH_SALE / MIX — lado descuento: a diferencia de la comisión (que se
// calcula al vuelo, sin tocar nada externo), el % que ve el comprador SÍ
// vive en la tienda real de la marca — así que este lado tiene que llamar
// la API de Shopify/WooCommerce para subirlo al arrancar y devolverlo al
// terminar. syncDiscountBoosts() es lo que hace ambas cosas, y corre a
// diario junto con el resto de tareas del cron (ver
// /api/cron/pagos-diarios) — más la activación inmediata en createChallenge
// y la reversión inmediata en endChallenge, para no depender de esperar al
// cron de mañana.
// ----------------------------------------------------------------------------

type DiscountEnrollment = {
  discountCode: string;
  shopifyPriceRuleId: string | null;
  wooCouponId: string | null;
  creator: { displayName: string };
};

type DiscountBrand = {
  companyName: string;
  storeType: string;
  storeUrl: string | null;
  shopifyAccessToken: string | null;
  wooConsumerKey: string | null;
  wooConsumerSecret: string | null;
};

/// Nunca deja que una falla de la tienda real bloquee la campaña — igual que
/// setBrandDiscountCodesActive en payment-service.ts para Nivel 3, se loguea
/// y se le avisa al admin OWNER por enrollment fallido, y se sigue con el
/// resto (una marca sin tienda conectada simplemente no tiene nada que
/// tocar aquí — la campaña sigue existiendo igual).
async function setEnrollmentDiscountValue(
  enrollment: DiscountEnrollment,
  brand: DiscountBrand,
  discountPercent: number,
  challengeName: string,
  accion: string
) {
  try {
    if (brand.storeType === "SHOPIFY" && brand.storeUrl && brand.shopifyAccessToken && enrollment.shopifyPriceRuleId) {
      await setShopifyDiscountValue({
        storeUrl: brand.storeUrl,
        accessToken: brand.shopifyAccessToken,
        priceRuleId: enrollment.shopifyPriceRuleId,
        discountPercent,
      });
    } else if (
      brand.storeType === "WOOCOMMERCE" &&
      brand.storeUrl &&
      brand.wooConsumerKey &&
      brand.wooConsumerSecret &&
      enrollment.wooCouponId
    ) {
      await setWooCommerceCouponValue({
        storeUrl: brand.storeUrl,
        consumerKey: brand.wooConsumerKey,
        consumerSecret: brand.wooConsumerSecret,
        couponId: enrollment.wooCouponId,
        discountPercent,
      });
    }
  } catch (err) {
    const isKnownApiError = err instanceof ShopifyApiError || err instanceof WooCommerceApiError;
    console.error(
      `[campañas] no se pudo ${accion} el % de descuento del código "${enrollment.discountCode}" de ${brand.companyName}:`,
      isKnownApiError ? err.message : err
    );

    const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        createNotification(admin.id, "DISCOUNT_BOOST_FAILED_ADMIN", {
          accion,
          codigo: enrollment.discountCode,
          creador: enrollment.creator.displayName,
          marca: brand.companyName,
          campana: challengeName,
        })
      )
    );
  }
}

async function applyDiscountBoost(challenge: { id: string; offerId: string; name: string; config: Prisma.JsonValue }) {
  const cfg = challenge.config as { newDiscountPercent?: number };
  // Esta campaña (FLASH_SALE o MIX) puede solo tener el lado de comisión
  // configurado, sin tocar el descuento — en ese caso no hay nada que subir
  // en la tienda real, así que no se marca discountBoostActive ni se llama
  // ninguna API externa.
  if (cfg.newDiscountPercent == null) return;

  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: challenge.offerId }, include: { brand: true } });
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { offerId: challenge.offerId, status: "ACTIVE" },
    include: { creator: true },
  });

  for (const enrollment of enrollments) {
    await setEnrollmentDiscountValue(enrollment, offer.brand, cfg.newDiscountPercent, challenge.name, "subir");
  }

  await prisma.challenge.update({ where: { id: challenge.id }, data: { discountBoostActive: true } });
}

async function revertDiscountBoost(challenge: { id: string; offerId: string; name: string }) {
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: challenge.offerId }, include: { brand: true } });
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { offerId: challenge.offerId, status: "ACTIVE" },
    include: { creator: true },
  });

  for (const enrollment of enrollments) {
    // El % "normal" al que hay que devolverlo no se guardó aparte — se
    // recalcula igual que en todos lados (override del creador, si no el de
    // la oferta), porque esa sigue siendo la única fuente de verdad.
    const normalPercent = Number(enrollment.discountPercentOverride ?? offer.defaultDiscountPercent);
    await setEnrollmentDiscountValue(enrollment, offer.brand, normalPercent, challenge.name, "devolver a su valor normal");
  }

  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { discountBoostActive: false, status: "ENDED" },
  });
}

/// Corre a diario (ver /api/cron/pagos-diarios): prende el descuento
/// elevado de las campañas que ya arrancaron y todavía no se aplicó, y lo
/// devuelve a su valor normal en las que ya terminaron y seguía aplicado.
/// Cubre los casos que la activación/reversión inmediata (en createChallenge
/// y endChallenge) no alcanza a cubrir — sobre todo campañas programadas
/// para arrancar en una fecha futura.
///
/// LIMITACIÓN CONOCIDA: un creador que se une a la oferta a mitad de una
/// campaña activa recibe su código nuevo con el % normal (ver
/// provisionDiscountCodeForEnrollment en attribution-service.ts, que no
/// consulta campañas) — el cron del día siguiente no lo corrige porque para
/// esa campaña discountBoostActive ya es true. En la práctica es un caso
/// raro (unirse justo en medio de una ventana de días), pero queda anotado.
export async function syncDiscountBoosts() {
  const now = new Date();

  const toActivate = await prisma.challenge.findMany({
    where: {
      type: { in: ["FLASH_SALE", "MIX"] },
      status: "ACTIVE",
      discountBoostActive: false,
      startDate: { lte: now },
      endDate: { gt: now },
    },
  });
  for (const challenge of toActivate) {
    await applyDiscountBoost(challenge);
  }

  const toRevert = await prisma.challenge.findMany({
    where: { type: { in: ["FLASH_SALE", "MIX"] }, status: "ACTIVE", discountBoostActive: true, endDate: { lte: now } },
  });
  for (const challenge of toRevert) {
    await revertDiscountBoost(challenge);
  }

  return { activatedCount: toActivate.length, revertedCount: toRevert.length };
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
    select: { offerId: true, discountCode: true, commissionPercentOverride: true, discountPercentOverride: true },
  });
  const offerIds = enrollments.map((e) => e.offerId);
  if (offerIds.length === 0) return [];
  // Por oferta — el código del creador y su comisión/descuento efectivos
  // (con override si tiene uno), para no tener que ir a buscarlos aparte en
  // la UI.
  const enrollmentByOffer = new Map(enrollments.map((e) => [e.offerId, e]));

  const challenges = await prisma.challenge.findMany({
    where: { offerId: { in: offerIds }, status: "ACTIVE" },
    include: { offer: { include: { brand: true } }, rewards: { where: { creatorId } } },
    orderBy: { endDate: "asc" },
  });

  const result = [];
  for (const challenge of challenges) {
    const myReward = challenge.rewards[0] ?? null;

    if (challenge.type === "GOAL_BONUS" || challenge.type === "MIX") {
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
        enrollment: enrollmentByOffer.get(challenge.offerId)!,
      });
    } else {
      result.push({ challenge, myReward, progress: null, enrollment: enrollmentByOffer.get(challenge.offerId)! });
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
      if (challenge.type === "GOAL_BONUS" || challenge.type === "MIX") {
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
