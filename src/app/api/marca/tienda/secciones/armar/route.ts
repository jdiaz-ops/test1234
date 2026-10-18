import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { completeHomeSections } from "@/server/services/storefront-default-home-service";
import { listStorefrontSections } from "@/server/services/storefront-section-service";

/// "Armar portada básica" en Diseño → Página de inicio: agrega categorías,
/// novedades y catálogo debajo de lo que la marca ya tenga (ver
/// storefront-default-home-service.ts).
export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await completeHomeSections(profile.id);
  if (result.skipped === "COMPLETE") {
    return NextResponse.json({ error: "Tu página de inicio ya tiene categorías, novedades y catálogo." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, created: result.created, sections: await listStorefrontSections(profile.id) });
}
