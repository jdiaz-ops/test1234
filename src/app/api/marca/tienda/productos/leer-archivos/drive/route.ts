import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { DriveError, listDriveFolder } from "@/server/services/drive-reader";

/// Lista los archivos de una carpeta pública de Google Drive (con sus
/// subcarpetas) para "Desde archivos". Ver drive-reader.ts.
export const maxDuration = 60;

const bodySchema = z.object({ url: z.string().trim().min(10).max(500) });

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pega el link de la carpeta de Drive." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await listDriveFolder(body.data.url)) });
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[drive]", err);
    return NextResponse.json({ error: "No se pudo leer la carpeta." }, { status: 500 });
  }
}
