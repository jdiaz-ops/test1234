import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { monthlyCostSchema } from "@/lib/validation/admin";
import { upsertMonthlyCost } from "@/server/services/admin-dashboard-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = monthlyCostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await upsertMonthlyCost(new Date(parsed.data.month), parsed.data.amount, parsed.data.note);
  return NextResponse.json({ ok: true });
}
