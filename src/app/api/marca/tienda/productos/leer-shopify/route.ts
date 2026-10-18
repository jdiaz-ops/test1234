import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { MAX_PAGES, ShopifyStoreError } from "@/lib/shopify-products-json";
import { SHOPIFY_POLICY_KINDS } from "@/lib/shopify-theme";
import {
  readShopifyCollectionProducts,
  readShopifyCollections,
  readShopifyFreeShippingThreshold,
  readShopifyPage,
  readShopifyShippingRates,
  readShopifyStorefront,
  readShopifyStorePage,
} from "@/server/services/shopify-store-reader";

/// Lee una pieza de una tienda Shopify a partir de su link (ver
/// shopify-store-reader.ts): una página del catálogo, la lista de
/// colecciones, los productos de una colección, la portada (colores,
/// letra, logo, menú, pagos, píxeles, redes) o los fletes probando
/// carritos. Solo lee: la importación va aparte, por lotes
/// (importar-shopify, colecciones/importar-shopify, diseno/importar-
/// shopify, envios/importar-shopify). El navegador pide pieza por pieza.
export const maxDuration = 60;

const variantSchema = z.object({
  variantId: z.number().int().positive(),
  unitPrice: z.number().positive(),
  productName: z.string().max(120),
});

const bodySchema = z.object({
  url: z.string().trim().min(4).max(500),
  part: z.enum(["productos", "colecciones", "coleccion", "tema", "envios", "pagina", "politica"]).default("productos"),
  page: z.number().int().min(1).max(MAX_PAGES).default(1),
  handle: z.string().trim().min(1).max(255).optional(),
  policy: z.enum(SHOPIFY_POLICY_KINDS).optional(),
  /// Solo para part = "envios".
  step: z.enum(["tarifas", "umbral"]).default("tarifas"),
  regions: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  region: z.string().trim().max(60).optional(),
  variant: variantSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(100).default(1),
  maxQuantity: z.number().int().min(1).max(100).default(40),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // Una tienda con muchas colecciones pide una lectura por colección, y
  // los fletes van de a 12 departamentos.
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
      case "pagina": {
        if (!handle) return NextResponse.json({ error: "Falta la página." }, { status: 400 });
        return NextResponse.json({ ok: true, ...(await readShopifyPage(url, { handle })) });
      }
      case "politica": {
        if (!body.data.policy) return NextResponse.json({ error: "Falta la política." }, { status: 400 });
        return NextResponse.json({ ok: true, ...(await readShopifyPage(url, { policy: body.data.policy })) });
      }
      case "envios": {
        if (body.data.step === "umbral") {
          if (!body.data.region || !body.data.variant) {
            return NextResponse.json({ error: "Falta el departamento o el producto de prueba." }, { status: 400 });
          }
          const result = await readShopifyFreeShippingThreshold(url, {
            region: body.data.region,
            variant: body.data.variant,
            maxQuantity: body.data.maxQuantity,
          });
          return NextResponse.json({ ok: true, ...result });
        }
        if (body.data.regions.length === 0) {
          return NextResponse.json({ error: "Faltan los departamentos a probar." }, { status: 400 });
        }
        const result = await readShopifyShippingRates(url, {
          regions: body.data.regions,
          quantity: body.data.quantity,
          variant: body.data.variant ?? null,
        });
        return NextResponse.json({ ok: true, ...result });
      }
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
