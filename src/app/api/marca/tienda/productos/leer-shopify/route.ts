import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { MAX_PAGES, ShopifyStoreError } from "@/lib/shopify-products-json";
import {
  readShopifyCollectionProducts,
  readShopifyCollections,
  readShopifyStorefront,
  readShopifyStorePage,
} from "@/server/services/shopify-store-reader";

/// Lee una pieza de una tienda Shopify a partir de su link (ver
/// shopify-store-reader.ts): una página del catálogo, la lista de
/// colecciones, los productos de una colección, o la portada (colores,
/// letra, logo y menú). Solo lee: la importación va aparte, por lotes
/// (importar-shopify, colecciones/importar-shopify, diseno/importar-
/// shopify). El navegador pide pieza por pieza.
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().trim().min(4).max(500),
  part: z.enum(["productos", "colecciones", "coleccion", "tema"]).default("productos"),
  page: z.number().int().min(1).max(MAX_PAGES).default(1),
  handle: z.string().trim().min(1).max(255).optional(),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // Una tienda con muchas colecciones pide una lectura por colección.
  const limited = await limitOrReject(req, `leer-shopify:${profile.id}`, 400, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pega el link de tu tienda Shopify." }, { status: 400 });
  const { url, part, page, handle } = body.data;

  try {
    switch (part) {
      case "colecciones":
        return NextResponse.json({ ok: true, ...(await readShopifyCollections(url)) });
      case "coleccion": {
        if (!handle) return NextResponse.json({ error: "Falta la colección." }, { status: 400 });
        return NextResponse.json({ ok: true, ...(await readShopifyCollectionProducts(url, handle, page)) });
      }
      case "tema":
        return NextResponse.json({ ok: true, ...(await readShopifyStorefront(url)) });
      default:
        return NextResponse.json({ ok: true, ...(await readShopifyStorePage(url, page)) });
    }
  } catch (err) {
    if (err instanceof ShopifyStoreError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[leer-shopify]", part, err);
    return NextResponse.json(
      { error: "No pudimos leer la tienda en este momento. Intenta de nuevo o importa con el CSV." },
      { status: 502 },
    );
  }
}
