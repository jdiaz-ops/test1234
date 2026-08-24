import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveEligibleCommissions } from "@/server/services/commission-service";
import {
  runBrandCharges,
  runCreatorPayouts,
  markOverdueCharges,
  sendUpcomingDueReminders,
  sendDeactivationReminders,
  deactivateOverdueBrands,
} from "@/server/services/payment-service";
import {
  approveEligibleChallengeRewards,
  closeEndedLeaderboards,
  sendChallengeUrgencyReminders,
  syncDiscountBoosts,
  notifyStartedCampaigns,
} from "@/server/services/challenge-service";
import { evaluateCreatorBadges } from "@/server/services/creator-badge-service";
import { sendOnboardingReminders } from "@/server/services/creator-onboarding-service";

/// Punto de entrada para el cron diario real. Soporta dos formas de
/// autenticarse, según quién lo llame:
///  - Vercel Cron llama por GET y manda `Authorization: Bearer <CRON_SECRET>`
///    automáticamente (así funciona su cron nativo — ver vercel.json).
///  - Cualquier otro scheduler externo (o una prueba manual con curl) puede
///    llamar por POST con el header `x-cron-secret: <CRON_SECRET>`.
///
/// Cada día: 1) levanta la espera de 15 días de comisiones y premios de
/// retos vencidos, 2) cierra los leaderboards que ya terminaron, 3) manda
/// recordatorios a las marcas con un corte por vencer (48h/24h antes),
/// 4) marca como OVERDUE (Nivel 2: panel bloqueado, marketplace y códigos
/// siguen funcionando) los cortes cuyo plazo de pago ya venció sin
/// comprobante verificado, 5) manda el aviso de "se te va a desactivar el
/// servicio" a las marcas OVERDUE cerca de su fecha de desactivación,
/// 6) pasa a DEACTIVATED (Nivel 3: fuera del marketplace, códigos dejan de
/// atribuir) los cortes OVERDUE cuyo plazo de desactivación ya venció,
/// 7) manda avisos de urgencia a creadores con un reto por cerrar (3
/// días/1 día antes) en el que pueden participar y no han completado,
/// 7.5) prende/apaga el % de descuento real en la tienda de las campañas
/// que arrancan o terminan hoy con el lado de descuento activado,
/// 7.75) avisa a los creadores vinculados cuando arranca una Misión/Flash
/// Sale/Mix programada a futuro (la que arranca el mismo día ya se avisa
/// al crearla — esto es solo para las que quedaron pendientes),
/// 8) otorga las insignias nuevas que ya se ganaron los creadores,
/// 9) manda recordatorios de onboarding a creadores (3 y 7 días de
/// registrados) que todavía no completaron su perfil, 10) si hoy es el
/// día de corte configurado, genera el aviso de cobro a las marcas
/// (Nivel 1), 11) si hoy es el día de pago configurado, paga a los
/// creadores — sin importar el estado de pago de sus marcas.
async function runDailyJob() {
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const today = new Date().getDate();

  const approvedCommissions = await approveEligibleCommissions();
  const closedLeaderboards = await closeEndedLeaderboards();
  const approvedRewards = await approveEligibleChallengeRewards();
  const reminders = await sendUpcomingDueReminders();
  const overdue = await markOverdueCharges();
  const deactivationReminders = await sendDeactivationReminders();
  const deactivated = await deactivateOverdueBrands();
  const challengeUrgency = await sendChallengeUrgencyReminders();
  const discountBoosts = await syncDiscountBoosts();
  const campaignsStarted = await notifyStartedCampaigns();
  const badges = await evaluateCreatorBadges();
  const onboardingReminders = await sendOnboardingReminders();

  const chargeResults = today === config.chargeDayOfMonth ? await runBrandCharges() : [];
  const payoutResults = today === config.payoutDayOfMonth ? await runCreatorPayouts() : [];

  return {
    ok: true,
    commissionsApproved: approvedCommissions.approvedCount,
    leaderboardsClosed: closedLeaderboards.closedCount,
    rewardsApproved: approvedRewards.approvedCount,
    remindersSent: reminders.sentCount,
    brandsLocked: overdue.lockedCount,
    deactivationRemindersSent: deactivationReminders.sentCount,
    brandsDeactivated: deactivated.deactivatedCount,
    challengeUrgencyPingsSent: challengeUrgency.sentCount,
    discountBoostsActivated: discountBoosts.activatedCount,
    discountBoostsReverted: discountBoosts.revertedCount,
    campaignsStartedNotified: campaignsStarted.notifiedCount,
    badgesAwarded: badges.awardedCount,
    onboardingRemindersSent: onboardingReminders.sentCount,
    brandCharges: chargeResults.length,
    creatorPayouts: payoutResults.length,
  };
}

function isAuthorized(req: Request) {
  if (!process.env.CRON_SECRET) return false;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const custom = req.headers.get("x-cron-secret");
  if (custom === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await runDailyJob());
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await runDailyJob());
}
