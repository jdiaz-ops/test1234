import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { removeTestCharge, PaymentError } from "@/server/services/payment-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { chargeId } = await req.json();
  if (typeof chargeId !== "string" || !chargeId) {
    return NextResponse.json({ error: "Falta el corte" }, { status: 400 });
  }

  try {
    await removeTestCharge(chargeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
