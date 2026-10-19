import { NextResponse } from "next/server";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { importShopifyProductsSchema } from "@/lib/validation/brand";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";
import { applyProductFamilies } from "@/server/services/product-family-service";
import { forgetPhotoShape } from "@/server/services/photo-shape-service";

/// Un lote de hasta 25 productos por request — el navegador ya leyó el
/// CSV completo (ver shopify-importer.tsx) y va mandando de a poco,
/// así una tienda con cientos de productos no depende de que un solo
/// request termine dentro del tiempo máximo de una función de Vercel.
export const maxDuration = 60;

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });

  const body = await req.json();
  const parsed = importShopifyProductsSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.message} (${issue.path.join(".")})` },
      { status: 400 },
    );
  }

  const results = await importShopifyProducts(profile.id, parsed.data.products);
  // Las familias (otros aromas, tonos, tamaños) se arman solas con lo que
  // va entrando; si falla, la importación igual vale.
  let families: { families: number; products: number } | null = null;
  try {
    families = await applyProductFamilies(profile.id);
  } catch (err) {
    console.error("[familias]", err);
  }
  // Con fotos nuevas, la próxima visita a la tienda vuelve a medir su forma.
  await forgetPhotoShape(profile.id).catch(() => {});
  return NextResponse.json({ ok: true, results, families });
}
