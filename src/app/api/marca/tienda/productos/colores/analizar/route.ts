import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { COLOR_BATCH_SIZE, ColorFamilyError, proposeColorFamilies } from "@/server/services/color-family-service";

/// Un lote de hasta COLOR_BATCH_SIZE productos: la IA mira sus fotos y
/// propone la familia de color de cada uno (no guarda nada). El navegador
/// manda los lotes de a uno — ver color-families-tool.tsx.
export const maxDuration = 60;

const bodySchema = z.object({ productIds: z.array(z.string().min(1).max(40)).min(1).max(COLOR_BATCH_SIZE) });

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  // Una tienda de 2000 productos son 200 lotes.
  const limited = await limitOrReject(req, `colores-ia:${profile.id}`, 400, 3600);
  if (limited) return limited;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Productos inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ proposals: await proposeColorFamilies(profile.id, body.data.productIds) });
  } catch (err) {
    if (err instanceof ColorFamilyError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[familias-color]", err);
    return NextResponse.json({ error: "La IA no respondió. Intenta de nuevo." }, { status: 502 });
  }
}
