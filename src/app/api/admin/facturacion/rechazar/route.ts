import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { rejectChargeSchema } from "@/lib/validation/admin";
import { rejectPaymentProof } from "@/server/services/payment-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = rejectChargeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  await rejectPaymentProof(parsed.data.chargeId, admin.id, parsed.data.reason);
  return NextResponse.json({ ok: true });
}
