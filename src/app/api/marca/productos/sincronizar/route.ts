import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { syncProductsForBrand, ProductSyncError } from "@/server/services/product-sync-service";

export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const result = await syncProductsForBrand(profile.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ProductSyncError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo sincronizar el catálogo." }, { status: 500 });
  }
}
