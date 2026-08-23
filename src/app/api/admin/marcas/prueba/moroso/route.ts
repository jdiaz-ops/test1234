import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { createTestOverdueCharge } from "@/server/services/payment-service";

/// Solo para demostración — simula un corte ya vencido en una marca para
/// ver en vivo el aviso de bloqueo/moroso, sin esperar un ciclo real.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { brandId } = await req.json();
  if (typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ error: "Falta la marca" }, { status: 400 });
  }

  const charge = await createTestOverdueCharge(brandId);
  return NextResponse.json({ ok: true, charge });
}
