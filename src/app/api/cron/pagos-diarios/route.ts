import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveEligibleCommissions } from "@/server/services/commission-service";
import {
  runBrandCharges,
  runCreatorPayouts,
  markOverdueCharges,
  sendUpcomingDueReminders,
} from "@/server/services/payment-service";
import {
  approveEligibleChallengeRewards,
  closeEndedLeaderboards,
  sendChallengeUrgencyReminders,
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
/// 4) marca como OVERDUE (y bloquea) los cortes cuyo plazo de pago ya
/// venció sin comprobante verificado, 5) manda avisos de urgencia a
/// creadores con un reto por cerrar (3 días/1 día antes) en el que pueden
/// participar y no han completado, 6) otorga las insignias nuevas que ya se
/// ganaron los creadores, 7) manda recordatorios de onboarding a creadores
/// (3 y 7 días de registrados) que todavía no completaron su perfil,
/// 8) si hoy es el día de corte configurado, genera el aviso de cobro a
/// las marcas, 9) si hoy es el día de pago configurado, paga a los
/// creadores — sin importar el estado de pago de sus marcas.
async function runDailyJob() {
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const today = new Date().getDate();

  const approvedCommissions = await approveEligibleCommissions();
  const closedLeaderboards = await closeEndedLeaderboards();
  const approvedRewards = await approveEligibleChallengeRewards();
  const reminders = await sendUpcomingDueReminders();
  const overdue = await markOverdueCharges();
  const challengeUrgency = await sendChallengeUrgencyReminders();
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
    challengeUrgencyPingsSent: challengeUrgency.sentCount,
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
