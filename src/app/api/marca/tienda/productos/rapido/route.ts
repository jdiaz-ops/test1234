import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { quickUpdateProductSchema } from "@/lib/validation/brand";
import {
  quickUpdateManualProduct,
  BrandStoreProductError,
} from "@/server/services/brand-store-product-service";

/// Inventario / estado desde la tabla de Productos. Ver
/// quickUpdateManualProduct.
export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = quickUpdateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const { productId, ...data } = parsed.data;
    const product = await quickUpdateManualProduct(profile.id, productId, data);
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    if (err instanceof BrandStoreProductError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[productos] rapido falló", err);
    return NextResponse.json(
      { error: "No se pudo guardar por un error del servidor. Intenta de nuevo en un momento." },
      { status: 500 },
    );
  }
}
