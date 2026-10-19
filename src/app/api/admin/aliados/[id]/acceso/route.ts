import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAllyLoginEmail } from "@/lib/email";
import { ALLY_ADMIN_FORBIDDEN, requireAllyAdmin } from "@/lib/ally-admin";
import { ADMIN_LOGIN_LINK_MINUTES, createAllyLoginLink } from "@/server/services/ally-service";

/// Un link de acceso al portal del aliado (dura 7 días, sirve una vez) para
/// mandárselo por WhatsApp, o por correo con `send`.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const { id } = await params;
  const body = z.object({ send: z.boolean().default(false) }).safeParse(await req.json().catch(() => ({})));
  const ally = await prisma.allyProfile.findUnique({ where: { id }, select: { userId: true, name: true, user: { select: { email: true } } } });
  if (!ally) return NextResponse.json({ error: "No encontramos ese aliado." }, { status: 404 });
  const url = await createAllyLoginLink(ally.userId, ADMIN_LOGIN_LINK_MINUTES);
  let emailed: string | null = null;
  if (body.success && body.data.send) {
    const result = await sendAllyLoginEmail(ally.user.email, { name: ally.name, url, minutes: ADMIN_LOGIN_LINK_MINUTES });
    emailed = result.ok ? ally.user.email : null;
    if (!result.ok) return NextResponse.json({ ok: true, url, emailed, emailError: result.error });
  }
  return NextResponse.json({ ok: true, url, emailed });
}
