import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ALLY_ADMIN_FORBIDDEN, requireAllyAdmin } from "@/lib/ally-admin";
import { AllyError, linkAllyReferral, unlinkAllyReferral } from "@/server/services/ally-service";

/// Vincular al aliado la marca o creadora que trajo (o quitar el vínculo).
const bodySchema = z.object({
  leadId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  creatorId: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Elige una marca o una creadora." }, { status: 400 });
  try {
    await linkAllyReferral(id, body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AllyError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const referralId = new URL(req.url).searchParams.get("referralId") ?? "";
  const referral = await prisma.allyReferral.findFirst({ where: { id: referralId, allyId: id }, select: { id: true } });
  if (!referral) return NextResponse.json({ error: "No encontramos ese vínculo." }, { status: 404 });
  await unlinkAllyReferral(referral.id);
  return NextResponse.json({ ok: true });
}
