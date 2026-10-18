import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { prisma } from "@/lib/prisma";
import { limitOrReject } from "@/lib/rate-limit";
import { proposeCollectionMerge, sectorFromVertical } from "@/server/services/shopify-categorize-service";

/// Propone menos colecciones para una tienda que trae de más (ver
/// collection-merge.ts y shopify-categorize-service.ts). Solo propone; la
/// administradora elige en la vista previa de "Duplicar tienda".
export const maxDuration = 60;

const bodySchema = z.object({
  collections: z
    .array(
      z.object({
        handle: z.string().trim().min(1).max(255),
        name: z.string().trim().min(1).max(255),
        productHandles: z.array(z.string().max(255)).max(5000),
        sampleNames: z.array(z.string().max(255)).max(5).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `colecciones-reorganizar:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Lista de colecciones inválida." }, { status: 400 });
  const vertical = profile.verticalId
    ? await prisma.vertical.findUnique({ where: { id: profile.verticalId }, select: { name: true } })
    : null;
  const proposal = await proposeCollectionMerge({ collections: body.data.collections, sector: sectorFromVertical(vertical?.name) });
  return NextResponse.json({ ok: true, proposal });
}
