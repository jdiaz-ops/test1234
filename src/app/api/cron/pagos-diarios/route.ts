import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveEligibleCommissions } from "@/server/services/commission-service";
import { runBrandCharges, runCreatorPayouts, markOverdueCharges } from "@/server/services/payment-service";
import { approveEligibleChallengeRewards, closeEndedLeaderboards } from "@/server/services/challenge-service";

/// Punto de entrada para el cron diario real. Soporta dos formas de
/// autenticarse, según quién lo llame:
///  - Vercel Cron llama por GET y manda `Authorization: Bearer <CRON_SECRET>`
///    automáticamente (así funciona su cron nativo — ver vercel.json).
///  - Cualquier otro scheduler externo (o una prueba manual con curl) puede
///    llamar por POST con el header `x-cron-secret: <CRON_SECRET>`.
///
/// Cada día: 1) levanta la espera de 15 días de comisiones y premios de
/// retos vencidos, 2) cierra los leaderboards que ya terminaron, 3) marca
/// como OVERDUE (y bloquea) los cortes cuyo plazo de pago ya venció sin
/// comprobante verificado, 4) si hoy es el día de corte configurado,
/// genera el aviso de cobro a las marcas, 5) si hoy es el día de pago
/// configurado, paga a los creadores — sin importar el estado de pago de
/// sus marcas.
async function runDailyJob() {
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const today = new Date().getDate();

  const approvedCommissions = await approveEligibleCommissions();
  const closedLeaderboards = await closeEndedLeaderboards();
  const approvedRewards = await approveEligibleChallengeRewards();
  const overdue = await markOverdueCharges();

  const chargeResults = today === config.chargeDayOfMonth ? await runBrandCharges() : [];
  const payoutResults = today === config.payoutDayOfMonth ? await runCreatorPayouts() : [];

  return {
    ok: true,
    commissionsApproved: approvedCommissions.approvedCount,
    leaderboardsClosed: closedLeaderboards.closedCount,
    rewardsApproved: approvedRewards.approvedCount,
    brandsLocked: overdue.lockedCount,
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
