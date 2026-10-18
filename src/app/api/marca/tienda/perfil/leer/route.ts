import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { prisma } from "@/lib/prisma";
import { limitOrReject } from "@/lib/rate-limit";
import { extractBrandProfile, sectorFromVertical } from "@/server/services/brand-profile-extract-service";

/// Lee los datos del perfil (razón social, NIT, dirección, ciudad, correo,
/// teléfono, descripción) de los textos de la tienda anterior. Solo lee;
/// se guardan con perfil/importar. Ver brand-profile-extract-service.ts.
export const maxDuration = 60;

const bodySchema = z.object({
  storeName: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(1000).optional().nullable(),
  announcements: z.array(z.string().max(300)).max(4).optional(),
  categories: z.array(z.string().max(80)).max(50).optional(),
  texts: z.array(z.object({ title: z.string().max(200), text: z.string().max(60_000) })).max(8),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `perfil-leer:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Textos inválidos." }, { status: 400 });
  const vertical = profile.verticalId
    ? await prisma.vertical.findUnique({ where: { id: profile.verticalId }, select: { name: true } })
    : null;
  const result = await extractBrandProfile({ ...body.data, sector: sectorFromVertical(vertical?.name) });
  return NextResponse.json({ ok: true, ...result });
}
