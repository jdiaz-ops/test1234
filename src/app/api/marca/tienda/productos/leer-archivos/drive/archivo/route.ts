import { NextResponse } from "next/server";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import type { DriveEntryKind } from "@/lib/drive-folder";
import { downloadDriveFile, DriveError } from "@/server/services/drive-reader";

/// Baja un archivo de una carpeta pública de Drive para que el navegador
/// lo lea como si lo hubieran subido (el navegador no puede bajarlo
/// directo de Google). Ver drive-reader.ts.
export const maxDuration = 60;

const KINDS = new Set<DriveEntryKind>(["file", "doc", "sheet", "slides"]);

export async function GET(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const id = params.get("id") ?? "";
  const kind = (params.get("kind") ?? "file") as DriveEntryKind;
  if (!KINDS.has(kind)) return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });
  try {
    return await downloadDriveFile(id, kind);
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[drive archivo]", err);
    return NextResponse.json({ error: "No se pudo bajar el archivo." }, { status: 500 });
  }
}
