import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  createProductSchema,
  updateProductSchema,
  deleteManualProductSchema,
} from "@/lib/validation/brand";
import {
  listManualProducts,
  createManualProduct,
  updateManualProduct,
  deleteManualProduct,
  BrandStoreProductError,
} from "@/server/services/brand-store-product-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const products = await listManualProducts(profile.id);
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const product = await createManualProduct(profile.id, parsed.data);
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    if (err instanceof BrandStoreProductError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const { productId, ...data } = parsed.data;
    const product = await updateManualProduct(profile.id, productId, data);
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    if (err instanceof BrandStoreProductError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = deleteManualProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await deleteManualProduct(profile.id, parsed.data.productId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BrandStoreProductError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
