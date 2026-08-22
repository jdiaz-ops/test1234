import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { approveEligibleCommissions } from "@/server/services/commission-service";

/// Dispara manualmente el paso "levantar la espera de 15 días" — en
/// producción esto lo hace a diario el Motor de Pagos (tarea siguiente);
/// mientras tanto el admin lo puede correr desde Finanzas para no tener que
/// esperar los 15 días reales en pruebas.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await approveEligibleCommissions();
  return NextResponse.json({ ok: true, ...result });
}
