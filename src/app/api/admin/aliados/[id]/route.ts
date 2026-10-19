import { NextResponse } from "next/server";
import { z } from "zod";
import { ALLY_ADMIN_FORBIDDEN, requireAllyAdmin } from "@/lib/ally-admin";
import { setAllyStatus } from "@/server/services/ally-service";

/// Pausar o reactivar el link de un aliado.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const body = z.object({ status: z.enum(["ACTIVE", "PAUSED"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  await setAllyStatus(id, body.data.status);
  return NextResponse.json({ ok: true });
}
