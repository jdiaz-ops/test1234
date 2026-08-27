import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { monthlyCostSchema } from "@/lib/validation/admin";
import { createMonthlyCostEntry, deleteMonthlyCostEntry } from "@/server/services/admin-dashboard-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = monthlyCostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await createMonthlyCostEntry(new Date(parsed.data.month), parsed.data.label, parsed.data.amount);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Falta el id del gasto" }, { status: 400 });

  await deleteMonthlyCostEntry(id);
  return NextResponse.json({ ok: true });
}
