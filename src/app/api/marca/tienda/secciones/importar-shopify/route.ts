import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { CUSTOM_BLOCK_LAYOUTS } from "@/lib/storefront-sections";
import { importShopifySections } from "@/server/services/shopify-sections-import-service";

/// Secciones de la portada leídas de la tienda vieja (Shopify o
/// WooCommerce/otra, ver shopify-sections-import-service.ts). Se llama
/// después de productos y colecciones, porque las secciones apuntan a
/// ellos.
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
    links: z.array(z.string().max(500)).max(6).optional(),
  }),
  z.object({ type: z.literal("FEATURED_COLLECTION"), collectionHandle: handle, title: z.string().max(200) }),
  z.object({ type: z.literal("TEXT"), heading: z.string().max(200), body: z.string().max(5000) }),
  z.object({
    type: z.literal("CATEGORY_GRID"),
    title: z.string().max(200),
    subtitle: z.string().max(500).optional(),
    items: z.array(z.object({ collectionHandle: handle, imageUrl: url.nullable(), label: z.string().max(80) })).max(6),
  }),
  z.object({ type: z.literal("VIDEO"), url: z.string().max(500), title: z.string().max(200) }),
  z.object({ type: z.literal("FEATURED_PRODUCTS"), productHandles: z.array(handle).max(24), title: z.string().max(200) }),
  z.object({
    type: z.literal("INFO_COLUMNS"),
    items: z
      .array(z.object({ title: z.string().max(120), description: z.string().max(300), imageUrl: url.nullable().optional(), link: z.string().max(500).optional() }))
      .max(4),
  }),
  z.object({ type: z.literal("NEW_PRODUCTS"), title: z.string().max(200) }),
  z.object({ type: z.literal("ON_SALE_PRODUCTS"), title: z.string().max(200) }),
  z.object({ type: z.literal("PRODUCT_CATALOG"), title: z.string().max(200) }),
  z.object({ type: z.literal("IMAGE_CAROUSEL"), images: z.array(url).max(8) }),
  z.object({ type: z.literal("BRAND_CAROUSEL"), items: z.array(z.object({ imageUrl: url, link: z.string().max(500) })).max(12) }),
  z.object({ type: z.literal("INSTAGRAM_CTA"), title: z.string().max(200), description: z.string().max(500) }),
  z.object({
    type: z.literal("CATEGORY_BANNERS"),
    items: z.array(z.object({ collectionHandle: handle, imageUrl: url.nullable(), label: z.string().max(80) })).max(3),
  }),
  z.object({ type: z.literal("PROMO_BANNERS"), items: z.array(z.object({ imageUrl: url, link: z.string().max(500) })).max(3) }),
  z.object({
    type: z.literal("CUSTOM_BLOCK"),
    name: z.string().max(120),
    layout: z.enum(CUSTOM_BLOCK_LAYOUTS),
    title: z.string().max(300),
    text: z.string().max(5000),
    buttonText: z.string().max(80),
    buttonHref: z.string().max(500),
    imageUrl: url.nullable(),
    imagePosition: z.enum(["left", "right"]),
    columns: z.number().int().min(1).max(6),
    align: z.enum(["left", "center"]),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    items: z
      .array(z.object({ imageUrl: url.nullable(), title: z.string().max(300), text: z.string().max(3000), buttonText: z.string().max(80), link: z.string().max(500) }))
      .max(12),
  }),
]);

const bodySchema = z.object({
  /// Puede venir vacío: con `fillGaps` igual se arma la portada básica.
  sections: z.array(sectionSchema).max(20),
  replace: z.boolean().default(true),
  collectionSlugByHandle: z.record(z.string().max(255), z.string().max(120)).default({}),
  pageSlugByHandle: z.record(z.string().max(255), z.string().max(120)).optional(),
  fillGaps: z.boolean().default(false),
  /// Con `storeUrl`, los links de las páginas recién importadas que
  /// apuntaban a la tienda vieja se reescriben hacia acá.
  storeUrl: z.string().max(500).optional(),
  relinkPages: z.boolean().default(false),
  /// La portada la copió la IA (ver leer-portada): los títulos vacíos quedan vacíos.
  faithful: z.boolean().default(false),
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
