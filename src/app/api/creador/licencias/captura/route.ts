import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { uploadFile, FileUploadError } from "@/lib/file-upload";

/// Sube la captura del post (evidencia de qué contenido exactamente se
/// está ofreciendo en licencia) y devuelve la URL — separado de crear el
/// listado porque el creador puede subirla antes de terminar el resto del
/// formulario, igual que la imagen de un producto en Mi tienda.
export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Selecciona un archivo" },
      { status: 400 },
    );
  }

  try {
    const url = await uploadFile(file, `creadores/${profile.id}/licencias`);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof FileUploadError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
