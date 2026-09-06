import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { uploadFile, FileUploadError } from "@/lib/file-upload";

/// Sube la imagen de un producto de "Mi tienda" y devuelve la URL — separado
/// de crear/editar el producto porque la marca puede subir la foto antes de
/// terminar de llenar el resto del formulario.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
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
    const url = await uploadFile(file, `marcas/${profile.id}/productos`);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof FileUploadError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
