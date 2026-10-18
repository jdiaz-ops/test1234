import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { CatalogFilesError, organizeCatalog } from "@/server/services/catalog-files-reader";

/// Con todo lo leído de los archivos: une categorías, asigna las fotos
/// sueltas a su producto y propone colores. Ver catalog-files-reader.ts.
export const maxDuration = 60;

const bodySchema = z.object({
  products: z
    .array(
      z.object({
        id: z.string().max(40),
        name: z.string().max(255),
        category: z.string().max(80),
        price: z.number().nullable(),
      }),
    )
    .max(600),
  photos: z.array(z.object({ id: z.string().max(40), caption: z.string().max(300) })).max(300),
  brandNames: z.array(z.string().max(120)).max(50).default([]),
  brandColors: z.array(z.string().max(20)).max(60).default([]),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `organizar-archivos:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, ...(await organizeCatalog(body.data)) });
  } catch (err) {
    if (err instanceof CatalogFilesError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[organizar-archivos]", err);
    return NextResponse.json({ error: "No se pudo organizar el catálogo." }, { status: 500 });
  }
}
