import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { uploadFile, FileUploadError } from "@/lib/file-upload";
import { updatePlatformPaymentQrImage } from "@/server/services/admin-config-service";

/// El QR (Bre-B u otro) que se muestra en cada aviso de cobro — imagen
/// única para toda la plataforma, no por marca.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "Solo el propietario puede cambiar esto." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecciona una imagen" }, { status: 400 });
  }

  try {
    const url = await uploadFile(file, "config");
    await updatePlatformPaymentQrImage(url);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof FileUploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
