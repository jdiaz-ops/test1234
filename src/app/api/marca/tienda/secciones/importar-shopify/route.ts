import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { importShopifySections } from "@/server/services/shopify-sections-import-service";

/// Secciones de la portada leídas de la tienda Shopify (ver
/// shopify-sections-import-service.ts). Se llama después de productos y
/// colecciones, porque las secciones apuntan a ellos.
export const maxDuration = 60;

const url = z.string().max(1000);
const handle = z.string().trim().min(1).max(255);

const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("BANNER"),
    images: z.array(url).max(6),
    title: z.string().max(200),
    subtitle: z.string().max(500),
    buttonText: z.string().max(80),
    buttonHref: z.string().max(500),
  }),
  z.object({ type: z.literal("FEATURED_COLLECTION"), collectionHandle: handle, title: z.string().max(200) }),
  z.object({ type: z.literal("TEXT"), heading: z.string().max(200), body: z.string().max(5000) }),
  z.object({
    type: z.literal("CATEGORY_GRID"),
    title: z.string().max(200),
    items: z.array(z.object({ collectionHandle: handle, imageUrl: url.nullable(), label: z.string().max(80) })).max(6),
  }),
  z.object({ type: z.literal("VIDEO"), url: z.string().max(500), title: z.string().max(200) }),
  z.object({ type: z.literal("FEATURED_PRODUCTS"), productHandles: z.array(handle).max(8), title: z.string().max(200) }),
  z.object({
    type: z.literal("INFO_COLUMNS"),
    items: z.array(z.object({ title: z.string().max(120), description: z.string().max(300) })).max(4),
  }),
]);

const bodySchema = z.object({
  sections: z.array(sectionSchema).min(1).max(12),
  replace: z.boolean().default(true),
  collectionSlugByHandle: z.record(z.string().max(255), z.string().max(120)).default({}),
  pageSlugByHandle: z.record(z.string().max(255), z.string().max(120)).optional(),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `secciones-importar:${profile.id}`, 30, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const issue = body.error.issues[0];
    return NextResponse.json({ error: `${issue.message} (${issue.path.join(".")})` }, { status: 400 });
  }
  const result = await importShopifySections(profile.id, body.data);
  return NextResponse.json({ ok: true, ...result });
}
