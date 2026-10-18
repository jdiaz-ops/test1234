import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { prisma } from "@/lib/prisma";
import { limitOrReject } from "@/lib/rate-limit";
import { MAX_PRODUCTS_PER_CALL, proposeCollections, sectorFromVertical } from "@/server/services/shopify-categorize-service";

/// Propone categorías para los productos de una tienda Shopify que no
/// tiene colecciones (ver shopify-categorize-service.ts). Por tandas: la
/// primera define las categorías, las siguientes clasifican con ellas.
export const maxDuration = 60;

const bodySchema = z.object({
  products: z
    .array(
      z.object({
        handle: z.string().trim().min(1).max(255),
        name: z.string().trim().min(1).max(255),
        type: z.string().max(80).optional().nullable(),
        tags: z.array(z.string().max(60)).max(30).optional(),
      }),
    )
    .min(1)
    .max(MAX_PRODUCTS_PER_CALL),
  catalogNames: z.array(z.string().max(255)).max(2000).optional(),
  categories: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `colecciones-proponer:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Lista de productos inválida." }, { status: 400 });
  const vertical = profile.verticalId
    ? await prisma.vertical.findUnique({ where: { id: profile.verticalId }, select: { name: true } })
    : null;
  const result = await proposeCollections({ ...body.data, sector: sectorFromVertical(vertical?.name) });
  return NextResponse.json({ ok: true, ...result });
}
