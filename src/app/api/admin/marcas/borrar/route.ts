import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { brandDeletionPreview, BrandDeleteError, deleteBrandProfile } from "@/server/services/admin-brand-delete-service";

/// Borrar una marca (ver admin-brand-delete-service.ts). GET ?brandId=
/// muestra qué se borraría o por qué no se puede; POST la borra si se
/// escribe su nombre. Solo el Propietario.
async function owner() {
  const admin = await requireAdmin();
  return admin && isOwner(admin.adminRole) ? admin : null;
}

export async function GET(req: Request) {
  if (!(await owner())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const brandId = new URL(req.url).searchParams.get("brandId") ?? "";
  if (!brandId) return NextResponse.json({ error: "Falta la marca." }, { status: 400 });
  try {
    return NextResponse.json(await brandDeletionPreview(brandId));
  } catch (err) {
    if (err instanceof BrandDeleteError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("[borrar-marca] vista previa", err);
    return NextResponse.json({ error: "No se pudo revisar la marca." }, { status: 500 });
  }
}

const bodySchema = z.object({ brandId: z.string().min(1), confirmName: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const admin = await owner();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Escribe el nombre de la marca para confirmar." }, { status: 400 });
  try {
    const result = await deleteBrandProfile(body.data.brandId, body.data.confirmName);
    console.info(`[borrar-marca] ${admin.email} borró la marca "${result.deleted}" (${body.data.brandId})`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BrandDeleteError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[borrar-marca]", err);
    return NextResponse.json({ error: "No se pudo borrar la marca. No se borró nada." }, { status: 500 });
  }
}
