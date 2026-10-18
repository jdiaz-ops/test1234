import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { CatalogFilesError, extractCatalogItems } from "@/server/services/catalog-files-reader";

/// Lee con IA una pieza del material de una marca sin web: una imagen (una
/// página de PDF ya convertida en el navegador, una foto, un pantallazo)
/// o un pedazo de texto. Ver catalog-files-reader.ts. Solo lee.
export const maxDuration = 60;

const MAX_IMAGE_BASE64 = 4_000_000;

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    base64: z.string().min(10).max(MAX_IMAGE_BASE64),
    label: z.string().max(200).default(""),
  }),
  z.object({ kind: z.literal("text"), text: z.string().min(3).max(30_000), label: z.string().max(200).default("") }),
]);

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `leer-archivos:${profile.id}`, 300, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Archivo no válido o demasiado grande." }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, ...(await extractCatalogItems(body.data)) });
  } catch (err) {
    if (err instanceof CatalogFilesError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[leer-archivos]", err);
    return NextResponse.json({ error: "No se pudo leer este archivo." }, { status: 500 });
  }
}
