import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { setProductFeaturedSchema } from "@/lib/validation/brand";
import { setProductFeatured, ProductError } from "@/server/services/product-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = setProductFeaturedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await setProductFeatured(profile.id, parsed.data.productId, parsed.data.featured);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo actualizar el producto." }, { status: 500 });
  }
}
