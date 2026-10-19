import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { ShopifyStoreError } from "@/lib/shopify-products-json";
import { buildHomeOutline } from "@/lib/shopify-theme";
import { readStorefrontDocument } from "@/server/services/shopify-store-reader";
import { copyHomeWithClaude, homeCopyAvailable } from "@/server/services/home-copy-ai-service";

/// La portada de la tienda vieja copiada tal cual con IA, para "Duplicar
/// tienda" (ver home-copy.ts): se lee el HTML, se arma su esquema y la IA
/// dice qué sección de Marcolini reproduce cada bloque. Solo lee: devuelve
/// las secciones (en la forma de shopify-theme.ts) y el navegador las
/// manda a secciones/importar-shopify con el resto. `sections: null` = sin
/// IA o sin respuesta útil: el navegador se queda con la lectura por
/// reglas del tema.
export const maxDuration = 180;

const bodySchema = z.object({
  url: z.string().trim().min(4).max(500),
  storeName: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `leer-portada:${profile.id}`, 30, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Falta el link de la tienda." }, { status: 400 });
  if (!homeCopyAvailable()) return NextResponse.json({ ok: true, sections: null, reason: "sin-ia" });

  try {
    const doc = await readStorefrontDocument(body.data.url);
    const outline = buildHomeOutline(doc.html, doc.storeUrl, doc.css);
    const sections = await copyHomeWithClaude(outline, body.data.storeName ?? null);
    return NextResponse.json({
      ok: true,
      sections: sections && sections.length > 0 ? sections : null,
      reason: sections && sections.length > 0 ? null : "sin-respuesta",
      outlineItems: outline.items.length,
      truncated: outline.truncated,
    });
  } catch (err) {
    if (err instanceof ShopifyStoreError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[leer-portada]", err);
    return NextResponse.json({ ok: true, sections: null, reason: "error" });
  }
}
