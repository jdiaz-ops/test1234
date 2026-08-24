import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { createTestProducts } from "@/server/services/product-service";

/// Solo para demostración — crea 12 productos de mentira (esmaltes,
/// manicure) para una marca, como si vinieran recién sincronizados de su
/// tienda, para probar vitrina/colecciones sin depender de una tienda
/// Shopify/WooCommerce real conectada.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { brandId } = await req.json();
  if (typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ error: "Falta la marca" }, { status: 400 });
  }

  const result = await createTestProducts(brandId);
  return NextResponse.json({ ok: true, ...result });
}
