import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { activateDraftProducts } from "@/server/services/brand-store-product-service";

/// "Activar todos los borradores" en Mi tienda → Productos. Ver
/// activateDraftProducts.
export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const count = await activateDraftProducts(profile.id);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("[productos] activar-borradores falló", err);
    return NextResponse.json(
      { error: "No se pudieron activar los borradores. Intenta de nuevo en un momento." },
      { status: 500 },
    );
  }
}
