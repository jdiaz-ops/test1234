import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { runBrandCharges, runCreatorPayouts } from "@/server/services/payment-service";

/// Dispara manualmente el cobro del día 1 o el pago del día 15 — en
/// producción esto lo hace a diario /api/cron/pagos-diarios (llamado por un
/// cron externo); mientras tanto el admin lo puede correr desde Finanzas.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { action } = await req.json();

  if (action === "charge") {
    const results = await runBrandCharges();
    return NextResponse.json({ ok: true, results });
  }
  if (action === "payout") {
    const results = await runCreatorPayouts();
    return NextResponse.json({ ok: true, results });
  }
  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
