import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { listProductLines, renameProductLines } from "@/server/services/product-lines-service";

/// Nombres por línea: GET lista las líneas ("Gel Polish Rosados – …"), POST
/// les cambia el comienzo del nombre. Herramienta del administrador con
/// "Entrar como" — ver product-lines-service.ts.
export const maxDuration = 60;

const FORBIDDEN = { error: "Solo el administrador de Marcolini puede usar esta herramienta." };

export async function GET() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  return NextResponse.json({ lines: await listProductLines(profile.id) });
}

const bodySchema = z.object({
  changes: z.array(z.object({ line: z.string().min(1).max(255), newLine: z.string().trim().min(2, "Escribe el nombre de la línea.").max(200) })).min(1).max(200),
  titleCase: z.boolean().default(false),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await renameProductLines(profile.id, body.data.changes, body.data.titleCase)) });
}
