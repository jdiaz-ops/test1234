import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approveEligibleCommissions } from "@/server/services/commission-service";
import { runBrandCharges, runCreatorPayouts } from "@/server/services/payment-service";
import { approveEligibleChallengeRewards, closeEndedLeaderboards } from "@/server/services/challenge-service";

/// Punto de entrada para el cron diario real (ej. Vercel Cron, o cualquier
/// scheduler externo que llame esta URL una vez al día) — eso es
/// configuración de despliegue, no código; esta ruta es lo que ese cron
/// debe invocar. Protegida con CRON_SECRET para que nadie más la dispare.
///
/// Cada día: 1) levanta la espera de 15 días de comisiones y premios de
/// retos vencidos, 2) cierra los leaderboards que ya terminaron, 3) si hoy
/// es el día de cobro configurado, cobra a las marcas, 4) si hoy es el día
/// de pago configurado, paga a los creadores.
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const today = new Date().getDate();

  const approvedCommissions = await approveEligibleCommissions();
  const closedLeaderboards = await closeEndedLeaderboards();
  const approvedRewards = await approveEligibleChallengeRewards();

  const chargeResults = today === config.chargeDayOfMonth ? await runBrandCharges() : [];
  const payoutResults = today === config.payoutDayOfMonth ? await runCreatorPayouts() : [];

  return NextResponse.json({
    ok: true,
    commissionsApproved: approvedCommissions.approvedCount,
    leaderboardsClosed: closedLeaderboards.closedCount,
    rewardsApproved: approvedRewards.approvedCount,
    brandCharges: chargeResults.length,
    creatorPayouts: payoutResults.length,
  });
}
