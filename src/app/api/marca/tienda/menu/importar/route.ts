import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { ShopifyStoreError } from "@/lib/shopify-products-json";
import { StorefrontMenuError } from "@/server/services/store-page-service";
import { applyMenuImport, previewMenuImport } from "@/server/services/storefront-menu-import-service";

/// "Traer el menú de la tienda original" — solo admin con "Entrar como".
/// Sin `apply` muestra qué quedaría; con `apply: true` reemplaza el menú.
/// Ver storefront-menu-import-service.ts.
export const maxDuration = 60;

const schema = z.object({ url: z.string().trim().min(4, "Pega el link de la tienda.").max(300), apply: z.boolean().optional() });

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const result = parsed.data.apply ? await applyMenuImport(profile.id, parsed.data.url) : await previewMenuImport(profile.id, parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShopifyStoreError || err instanceof StorefrontMenuError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[menu-importar]", err);
    return NextResponse.json({ error: "No se pudo leer el menú de esa tienda." }, { status: 500 });
  }
}
