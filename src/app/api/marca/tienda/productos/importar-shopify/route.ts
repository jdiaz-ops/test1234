import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { importShopifyProductsSchema } from "@/lib/validation/brand";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";

/// Un lote de hasta 25 productos por request — el navegador ya leyó el
/// CSV completo (ver shopify-csv-importer.tsx) y va mandando de a poco,
/// así una tienda con cientos de productos no depende de que un solo
/// request termine dentro del tiempo máximo de una función de Vercel.
export const maxDuration = 60;

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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
  return NextResponse.json({ ok: true, results });
}
