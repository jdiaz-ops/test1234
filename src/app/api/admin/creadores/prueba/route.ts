import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { createTestCreators } from "@/server/services/admin-creator-service";

/// Mismo espíritu que /api/admin/marcas/prueba — crea 3 creadores de
/// mentira para probar el marketplace/portal de creador con "Entrar como".
export async function POST() {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await createTestCreators();
  return NextResponse.json({ ok: true, ...result });
}
