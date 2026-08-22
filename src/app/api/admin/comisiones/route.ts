import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { approveEligibleCommissions } from "@/server/services/commission-service";
import { approveEligibleChallengeRewards, closeEndedLeaderboards } from "@/server/services/challenge-service";

/// Dispara manualmente el paso "levantar la espera de 15 días" (comisiones
/// y premios de retos) y el cierre de leaderboards vencidos — en producción
/// esto lo hace a diario el cron del Motor de Pagos; mientras tanto el
/// admin lo puede correr desde Finanzas para no tener que esperar los 15
/// días reales en pruebas.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const commissions = await approveEligibleCommissions();
  const rewards = await approveEligibleChallengeRewards();
  const leaderboards = await closeEndedLeaderboards();

  return NextResponse.json({
    ok: true,
    approvedCount: commissions.approvedCount + rewards.approvedCount,
    commissionsApproved: commissions.approvedCount,
    rewardsApproved: rewards.approvedCount,
    leaderboardsClosed: leaderboards.closedCount,
  });
}
