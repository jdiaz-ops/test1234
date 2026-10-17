import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { applyShopifyDesign } from "@/server/services/shopify-design-import-service";

/// Aplica al panel de Diseño lo leído de la tienda Shopify: colores y
/// letra (publicados de una vez, salvo que se pida lo contrario), logo y
/// favicon descargados y subidos a Marcolini. Ver
/// shopify-design-import-service.ts.
export const maxDuration = 60;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");
const imageUrl = z.string().max(1000).regex(/^https:\/\//, "URL inválida").optional().nullable();

const bodySchema = z.object({
  colors: z
    .object({ fondo: hex, texto: hex, botones: hex, principal: hex, secundario: hex })
    .optional()
    .nullable(),
  fonts: z.object({ headingFont: z.string().max(60), bodyFont: z.string().max(60) }).optional().nullable(),
  logoUrl: imageUrl,
  faviconUrl: imageUrl,
  publish: z.boolean().default(true),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `diseno-importar:${profile.id}`, 30, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Diseño inválido." }, { status: 400 });
  const result = await applyShopifyDesign(profile.id, body.data);
  return NextResponse.json({ ok: true, ...result });
}
