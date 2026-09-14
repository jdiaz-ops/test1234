import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { discardDraftTheme } from "@/server/services/brand-theme-service";

/// Descarta los cambios sin publicar — el borrador vuelve a lo último
/// publicado (o a los valores por defecto si nunca publicó nada).
export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const theme = await discardDraftTheme(profile.id);
  return NextResponse.json({ ok: true, theme });
}
