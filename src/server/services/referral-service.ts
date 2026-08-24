import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { flagPotentialFraud } from "@/server/services/admin-fraud-service";

export class ReferralError extends Error {}

const BONUS_AMOUNT = 20000;

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

/// Se llama al registrar un creador nuevo, solo si vino con un código de
/// invitación. Falla en silencio (no bloquea el registro) si el código no
/// existe o si alguien intenta "invitarse a sí mismo" — un registro nunca
/// se debe caer por un código mal escrito o copiado de otra parte.
export async function createReferralFromCode(refCode: string, referredCreatorId: string) {
  const code = refCode.trim().toUpperCase();
  if (!code) return null;

  const referrer = await prisma.creatorProfile.findUnique({ where: { baseCode: code } });
  if (!referrer || referrer.id === referredCreatorId) return null;

  try {
    return await prisma.creatorReferral.create({
      data: { referrerId: referrer.id, referredId: referredCreatorId, bonusAmount: BONUS_AMOUNT },
    });
  } catch (err) {
    // @@unique([referredId]) — ya tenía un referido registrado antes (no
    // debería pasar en el flujo normal, pero nunca debe tumbar el registro).
    console.error(`[referidos] No se pudo registrar la invitación de ${code} para ${referredCreatorId}:`, err);
    return null;
  }
}

/// Se llama justo después de crear la primera Commission de un creador (ver
/// createCommissionForTransaction) — si ese creador fue referido por
/// alguien y todavía está PENDING, esta es su primera venta real: el bono
/// del que lo invitó queda calificado para pagar.
export async function checkReferralQualification(creatorId: string) {
  const referral = await prisma.creatorReferral.findUnique({
    where: { referredId: creatorId },
    include: { referred: true },
  });
  if (!referral || referral.status !== "PENDING") return;

  // Solo cuenta como "primera venta" si esta es realmente la única comisión
  // que tiene el creador hasta ahora — evita calificar de más si por algún
  // motivo esta función se llegara a invocar fuera de orden.
  const commissionCount = await prisma.commission.count({ where: { creatorProfileId: creatorId } });
  if (commissionCount !== 1) return;

  const updated = await prisma.creatorReferral.update({
    where: { id: referral.id },
    data: { status: "QUALIFIED", qualifiedAt: new Date() },
    include: { referrer: true },
  });

  await createNotification(updated.referrer.userId, "REFERRAL_QUALIFIED", {
    referido: referral.referred.displayName,
    monto: formatCOP(Number(updated.bonusAmount)),
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", adminRole: { in: ["OWNER", "FINANCE"] } },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification(admin.id, "REFERRAL_ADMIN", {
        referidor: updated.referrer.displayName,
        referido: referral.referred.displayName,
        monto: formatCOP(Number(updated.bonusAmount)),
      })
    )
  );

  await checkSuspiciousReferralQualification(referral.id, creatorId);
}

const MIN_QUALIFYING_SALE = 5000;
const FAST_QUALIFY_MINUTES = 10;

/// Detector de fraude: un bono de referido calificando con una venta
/// sospechosamente chica o sospechosamente rápida después del registro —
/// patrón típico de crear una cuenta "referida" solo para cobrar el bono.
/// Nunca bloquea el bono (sigue calificando igual), solo lo deja marcado
/// para que el admin lo revise antes de marcarlo pagado.
async function checkSuspiciousReferralQualification(referralId: string, referredCreatorId: string) {
  const qualifyingCommission = await prisma.commission.findFirst({
    where: { creatorProfileId: referredCreatorId },
    include: { transaction: true },
    orderBy: { createdAt: "asc" },
  });
  if (!qualifyingCommission) return;

  const referred = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: referredCreatorId } });
  const netAmount = Number(qualifyingCommission.transaction.netAmount);
  const minutesSinceRegistration =
    (qualifyingCommission.transaction.occurredAt.getTime() - referred.createdAt.getTime()) / 60000;

  const tooSmall = netAmount < MIN_QUALIFYING_SALE;
  const tooFast = minutesSinceRegistration >= 0 && minutesSinceRegistration < FAST_QUALIFY_MINUTES;
  if (!tooSmall && !tooFast) return;

  const reasonParts = [
    tooSmall ? `venta de solo ${formatCOP(netAmount)}` : null,
    tooFast ? `${Math.max(0, Math.round(minutesSinceRegistration))} minutos después de registrarse` : null,
  ].filter(Boolean);

  await flagPotentialFraud(
    qualifyingCommission.transactionId,
    `Posible bono de referido de mentira: ${referred.displayName} calificó el bono con ${reasonParts.join(" y ")} (referral ${referralId})`
  );
}

/// Su propio código para invitar, más el resumen de a quién ha invitado —
/// para la sección "Invita y gana" del portal.
export async function getReferralSummaryForCreator(creatorId: string) {
  const [profile, referralsMade] = await Promise.all([
    prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId }, select: { baseCode: true } }),
    prisma.creatorReferral.findMany({
      where: { referrerId: creatorId },
      include: { referred: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const earned = referralsMade
    .filter((r) => r.status === "QUALIFIED" || r.status === "PAID")
    .reduce((sum, r) => sum + Number(r.bonusAmount), 0);

  return { baseCode: profile.baseCode, referrals: referralsMade, earned };
}

/// Reporte completo para /admin/referidos.
export async function listAllReferrals() {
  return prisma.creatorReferral.findMany({
    include: { referrer: { select: { displayName: true } }, referred: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/// El admin confirma que ya transfirió el bono — igual de manual que un
/// pago normal a creador (ver markPayoutPaid en payment-service.ts). Solo
/// se puede marcar pagado un bono que ya calificó con una venta real.
export async function markReferralPaid(referralId: string) {
  const referral = await prisma.creatorReferral.findUniqueOrThrow({ where: { id: referralId } });
  if (referral.status !== "QUALIFIED") {
    throw new ReferralError("Este bono todavía no calificó para pago (el referido no ha vendido, o ya se marcó pagado).");
  }

  return prisma.creatorReferral.update({
    where: { id: referralId },
    data: { status: "PAID", paidAt: new Date() },
  });
}
