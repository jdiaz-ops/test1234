import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { applyColorFamilies, colorAssignmentsSchema, colorFamiliesAvailable, listColorCandidates } from "@/server/services/color-family-service";

/// Familias de color: GET lista los productos con su familia actual, POST
/// guarda las familias revisadas. Herramienta del administrador con
/// "Entrar como" — ver color-family-service.ts.
export const maxDuration = 60;

const FORBIDDEN = { error: "Solo el administrador de Marcolini puede usar esta herramienta." };

export async function GET() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  return NextResponse.json({ available: colorFamiliesAvailable(), products: await listColorCandidates(profile.id) });
}

const bodySchema = z.object({ assignments: colorAssignmentsSchema });

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Familias inválidas." }, { status: 400 });
  return NextResponse.json({ ok: true, ...(await applyColorFamilies(profile.id, body.data.assignments)) });
}
