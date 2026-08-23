import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { markPayoutPaid } from "@/server/services/payment-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { payoutId } = await req.json();
  if (typeof payoutId !== "string" || !payoutId) {
    return NextResponse.json({ error: "Falta el pago" }, { status: 400 });
  }

  await markPayoutPaid(payoutId);
  return NextResponse.json({ ok: true });
}
