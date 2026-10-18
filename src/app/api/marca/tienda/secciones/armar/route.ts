import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { buildDefaultHomeSections } from "@/server/services/storefront-default-home-service";
import { listStorefrontSections } from "@/server/services/storefront-section-service";

/// "Armar portada básica" en Diseño → Página de inicio: categorías,
/// novedades y catálogo para una marca que todavía no tiene secciones
/// (ver storefront-default-home-service.ts).
export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await buildDefaultHomeSections(profile.id);
  if (result.skipped === "HAS_SECTIONS") {
    return NextResponse.json({ error: "Tu página de inicio ya tiene secciones: edítalas o bórralas acá." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, created: result.created, sections: await listStorefrontSections(profile.id) });
}
