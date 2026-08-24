import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { markReferralPaid, ReferralError } from "@/server/services/referral-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { referralId } = await req.json();
  if (typeof referralId !== "string" || !referralId) {
    return NextResponse.json({ error: "Falta el referido" }, { status: 400 });
  }

  try {
    await markReferralPaid(referralId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReferralError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo marcar como pagado." }, { status: 500 });
  }
}
