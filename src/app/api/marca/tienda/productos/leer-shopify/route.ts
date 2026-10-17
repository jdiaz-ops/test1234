import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { MAX_PAGES, ShopifyStoreError } from "@/lib/shopify-products-json";
import { readShopifyStorePage } from "@/server/services/shopify-store-reader";

/// Lee una página del catálogo público de una tienda Shopify a partir de
/// su link y la devuelve ya convertida (ver shopify-store-reader.ts). Solo
/// lee: la importación en sí sigue yendo por lotes a importar-shopify,
/// igual que con el CSV. El navegador pide página por página.
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().trim().min(4).max(500),
  page: z.number().int().min(1).max(MAX_PAGES).default(1),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `leer-shopify:${profile.id}`, 120, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pega el link de tu tienda Shopify." }, { status: 400 });

  try {
    const page = await readShopifyStorePage(body.data.url, body.data.page);
    return NextResponse.json({ ok: true, ...page });
  } catch (err) {
    if (err instanceof ShopifyStoreError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[leer-shopify]", err);
    return NextResponse.json(
      { error: "No pudimos leer la tienda en este momento. Intenta de nuevo o importa con el CSV." },
      { status: 502 },
    );
  }
}
