import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { countExternalImages, rehostImages } from "@/server/services/image-rehost-service";

/// Fotos de productos y colecciones que todavía viven en otro servidor
/// (Shopify): GET cuenta cuántas quedan, POST copia unas pocas a
/// Marcolini. El navegador repite el POST hasta que no quede ninguna (ver
/// lib/rehost-images-client.ts).
export const maxDuration = 60;

const bodySchema = z.object({
  limit: z.number().int().min(1).max(10).default(6),
  /// URLs que ya fallaron en esta pasada, para no reintentarlas en bucle.
  skip: z.array(z.string().max(1000)).max(500).default([]),
});

export async function GET() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const { total } = await countExternalImages(profile.id);
  return NextResponse.json({ ok: true, total });
}

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `alojar-fotos:${profile.id}`, 600, 3600);
  if (limited) return limited;
  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  const result = await rehostImages(profile.id, body.data);
  return NextResponse.json({ ok: true, ...result });
}
