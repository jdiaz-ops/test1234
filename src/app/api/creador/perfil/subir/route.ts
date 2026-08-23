import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { prisma } from "@/lib/prisma";
import { uploadFile, FileUploadError } from "@/lib/file-upload";

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecciona una imagen" }, { status: 400 });
  }

  try {
    const url = await uploadFile(file, `creadores/${profile.id}`);
    await prisma.creatorProfile.update({ where: { id: profile.id }, data: { photoUrl: url } });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    if (err instanceof FileUploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
