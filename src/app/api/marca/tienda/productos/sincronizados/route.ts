import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { listSyncedProductsForImport } from "@/server/services/brand-store-product-service";

/// Lista de productos ya sincronizados de Shopify/WooCommerce, para el
/// picker de "Importar producto" en Crear productos.
export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const products = await listSyncedProductsForImport(profile.id);
  return NextResponse.json({ products });
}
