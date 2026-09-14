import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  getSyncedProductForImport,
  BrandStoreProductError,
} from "@/server/services/brand-store-product-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const product = await getSyncedProductForImport(profile.id, id);
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof BrandStoreProductError)
      return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
