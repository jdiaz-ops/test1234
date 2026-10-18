import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { OtherStoreError, scanStore } from "@/server/services/other-store-reader";

/// Un paso de la lectura de una tienda que no es Shopify (WooCommerce,
/// Tiendanube o cualquier otra) — ver other-store-reader.ts. El navegador
/// (shopify-importer.tsx) va pidiendo los pasos que devuelve cada
/// respuesta. Solo lee; la importación va por importar-shopify.
export const maxDuration = 60;

const bodySchema = z.object({
  origin: z.string().max(300).nullable().default(null),
  step: z.discriminatedUnion("step", [
    z.object({ step: z.literal("detect"), url: z.string().trim().min(3).max(500) }),
    z.object({ step: z.literal("woo-products"), page: z.number().int().min(1).max(200), base: z.string().max(400) }),
    z.object({ step: z.literal("pages"), urls: z.array(z.string().url().max(1000)).min(1).max(6) }),
  ]),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  // Una tienda sin API se lee de a 6 páginas de producto por paso.
  const limited = await limitOrReject(req, `leer-otra-tienda:${profile.id}`, 800, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pega el link de la tienda." }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, ...(await scanStore(body.data.origin, body.data.step)) });
  } catch (err) {
    if (err instanceof OtherStoreError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[leer-otra-tienda]", err);
    return NextResponse.json({ error: "No se pudo leer la tienda." }, { status: 500 });
  }
}
