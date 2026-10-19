import { NextResponse } from "next/server";
import { z } from "zod";
import { monthStart } from "@/lib/ally-earnings";
import { ALLY_ADMIN_FORBIDDEN, requireAllyAdmin } from "@/lib/ally-admin";
import { AllyError, recordAllyPayout, undoAllyPayout } from "@/server/services/ally-service";

/// Marcar pagado un mes de un aliado (o deshacerlo).
const period = z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido.");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAllyAdmin();
  if (!admin) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const body = z
    .object({ period, amount: z.number().positive("El valor debe ser mayor que cero.").max(1_000_000_000), reference: z.string().trim().max(120).optional().nullable() })
    .safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  try {
    await recordAllyPayout(id, { period: monthStart(body.data.period), amount: body.data.amount, reference: body.data.reference, paidById: admin.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AllyError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const value = period.safeParse(new URL(req.url).searchParams.get("period"));
  if (!value.success) return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  await undoAllyPayout(id, monthStart(value.data));
  return NextResponse.json({ ok: true });
}
