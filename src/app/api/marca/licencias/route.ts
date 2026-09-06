import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { listBrandLicenseCatalog } from "@/server/services/content-license-service";

/// Catálogo de contenido licenciable — solo de creadores ya vinculados
/// ACTIVE a esta marca (ver content-license-service.ts).
export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const content = await listBrandLicenseCatalog(profile.id);
  return NextResponse.json({ content });
}
