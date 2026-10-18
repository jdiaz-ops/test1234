import { NextResponse } from "next/server";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { applyProductFamilies, previewProductFamilies } from "@/server/services/product-family-service";

/// Familias de productos (otros aromas, tonos y tamaños): GET muestra qué
/// agruparía, POST lo aplica. Herramienta del administrador con "Entrar
/// como" — ver product-family-service.ts.
export const maxDuration = 60;

const FORBIDDEN = { error: "Solo el administrador de Marcolini puede usar esta herramienta." };

export async function GET() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  return NextResponse.json(await previewProductFamilies(profile.id));
}

export async function POST() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json(FORBIDDEN, { status: 403 });
  const result = await applyProductFamilies(profile.id);
  return NextResponse.json({ ok: true, ...result });
}
