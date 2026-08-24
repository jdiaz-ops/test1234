import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { createTestDeactivatedCharge } from "@/server/services/payment-service";

/// Solo para demostración — simula un corte directo en Nivel 3 (DEACTIVATED)
/// en una marca para ver en vivo que desaparece del marketplace y sus
/// códigos dejan de atribuir, sin esperar los dos ciclos reales de 72h
/// hábiles.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { brandId } = await req.json();
  if (typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ error: "Falta la marca" }, { status: 400 });
  }

  const charge = await createTestDeactivatedCharge(brandId);
  return NextResponse.json({ ok: true, charge });
}
