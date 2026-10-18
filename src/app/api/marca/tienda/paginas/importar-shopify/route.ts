import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { importShopifyPages } from "@/server/services/shopify-pages-import-service";

/// Páginas y políticas leídas de la tienda Shopify (ver
/// shopify-pages-import-service.ts). El cuerpo llega en HTML y se sanea
/// al guardarlo, como cualquier página escrita a mano.
export const maxDuration = 60;

const bodySchema = z.object({
  pages: z
    .array(
      z.object({
        handle: z.string().trim().min(1).max(255),
        title: z.string().trim().min(2).max(100),
        body: z.string().max(50_000),
        kind: z.enum(["page", "policy"]),
      }),
    )
    .min(1)
    .max(30),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `paginas-importar:${profile.id}`, 30, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const issue = body.error.issues[0];
    return NextResponse.json({ error: `${issue.message} (${issue.path.join(".")})` }, { status: 400 });
  }
  const result = await importShopifyPages(profile.id, body.data.pages);
  return NextResponse.json({ ok: true, ...result });
}
