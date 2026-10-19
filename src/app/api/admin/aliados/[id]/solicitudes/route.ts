import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ALLY_ADMIN_FORBIDDEN, requireAllyAdmin } from "@/lib/ally-admin";
import { setAllyLeadStatus } from "@/server/services/ally-service";

/// Aprobar, rechazar o volver a dejar pendiente una solicitud del link.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const body = z.object({ leadId: z.string().min(1), status: z.enum(["PENDING", "APPROVED", "REJECTED"]) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const lead = await prisma.allyLead.findFirst({ where: { id: body.data.leadId, allyId: id }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "No encontramos esa solicitud." }, { status: 404 });
  await setAllyLeadStatus(lead.id, body.data.status);
  return NextResponse.json({ ok: true });
}
