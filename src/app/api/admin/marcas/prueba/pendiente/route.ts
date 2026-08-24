import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { createTestPendingCharge } from "@/server/services/payment-service";

/// Solo para demostración — simula un corte recién generado (Nivel 1,
/// PENDING) en una marca para ver en vivo el aviso de cobro con las
/// instrucciones de pago en el dashboard, sin esperar al día de cobro real.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { brandId } = await req.json();
  if (typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ error: "Falta la marca" }, { status: 400 });
  }

  const charge = await createTestPendingCharge(brandId);
  return NextResponse.json({ ok: true, charge });
}
