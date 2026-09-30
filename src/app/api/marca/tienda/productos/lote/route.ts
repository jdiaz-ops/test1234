import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { bulkProductActionSchema } from "@/lib/validation/brand";
import {
  bulkProductAction,
  BrandStoreProductError,
} from "@/server/services/brand-store-product-service";

/// Acciones sobre varios productos a la vez. Ver bulkProductAction.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = bulkProductActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await bulkProductAction(profile.id, parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BrandStoreProductError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[productos] lote falló", err);
    return NextResponse.json(
      { error: "No se pudo aplicar el cambio. Intenta de nuevo en un momento." },
      { status: 500 },
    );
  }
}
