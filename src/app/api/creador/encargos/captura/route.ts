import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { uploadFile, FileUploadError } from "@/lib/file-upload";

/// Sube la captura de evidencia de un encargo de contenido entregado — ver
/// deliverPaidContent en paid-content-service.ts.
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
    const url = await uploadFile(file, `creadores/${profile.id}/encargos`);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof FileUploadError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
