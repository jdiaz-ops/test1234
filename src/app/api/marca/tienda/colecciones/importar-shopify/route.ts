import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { importShopifyCollections } from "@/server/services/shopify-collections-import-service";

/// Colecciones (con sus productos) y menú leídos de la tienda Shopify, o
/// las categorías propuestas cuando no tiene colecciones. Ver
/// shopify-collections-import-service.ts. Se llama una vez, después de
/// que los productos ya entraron por lotes.
export const maxDuration = 60;

const linkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(500),
});

const collectionSchema = z.object({
  handle: z.string().trim().min(1).max(255),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().max(1000).regex(/^https?:\/\//).optional().nullable(),
  sortOrder: z.enum(["MANUAL", "ALPHA_ASC", "ALPHA_DESC", "PRICE_ASC", "PRICE_DESC", "NEWEST"]).optional().nullable(),
  productHandles: z.array(z.string().trim().min(1).max(255)).max(5000),
});

const bodySchema = z.object({
  collections: z.array(collectionSchema).max(200),
  menu: z
    .object({ links: z.array(linkSchema).max(40), replace: z.boolean().default(true) })
    .optional()
    .nullable(),
  pageLinks: z
    .array(z.object({ handle: z.string().trim().min(1).max(255), slug: z.string().trim().min(1).max(120) }))
    .max(50)
    .optional(),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `colecciones-importar:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const issue = body.error.issues[0];
    return NextResponse.json({ error: `${issue.message} (${issue.path.join(".")})` }, { status: 400 });
  }
  const result = await importShopifyCollections(profile.id, body.data);
  return NextResponse.json({ ok: true, ...result });
}
