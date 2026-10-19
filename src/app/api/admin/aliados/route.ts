import { NextResponse } from "next/server";
import { z } from "zod";
import { ALLY_ADMIN_FORBIDDEN, requireAllyAdmin } from "@/lib/ally-admin";
import { AllyError, createAlly } from "@/server/services/ally-service";

/// Crear un aliado comercial (ver ally-service.ts).
const bodySchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del aliado.").max(120),
  email: z.string().trim().email("Escribe un correo válido.").max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  code: z.string().trim().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  if (!(await requireAllyAdmin())) return NextResponse.json(ALLY_ADMIN_FORBIDDEN, { status: 403 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  try {
    const user = await createAlly(body.data);
    return NextResponse.json({ ok: true, allyId: user.allyProfile!.id });
  } catch (err) {
    if (err instanceof AllyError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
