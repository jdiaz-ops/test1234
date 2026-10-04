import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { prisma } from "@/lib/prisma";
import { uploadFile, FileUploadError } from "@/lib/file-upload";

const FIELD_BY_KIND: Record<string, string> = {
  logo: "logoUrl",
  favicon: "faviconUrl",
  rut: "rutDocumentUrl",
  camara: "camaraComercioUrl",
};

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file");

  if (typeof kind !== "string" || !FIELD_BY_KIND[kind]) {
    return NextResponse.json({ error: "Tipo de archivo inválido" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecciona un archivo" }, { status: 400 });
  }

  // El ícono de la pestaña tiene que ser una imagen (un PDF no sirve).
  if (kind === "favicon" && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "El ícono tiene que ser una imagen PNG, JPG, WEBP o SVG." }, { status: 400 });
  }

  try {
    const url = await uploadFile(file, `marcas/${profile.id}`);
    await prisma.brandProfile.update({
      where: { id: profile.id },
      data: { [FIELD_BY_KIND[kind]]: url },
    });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof FileUploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
