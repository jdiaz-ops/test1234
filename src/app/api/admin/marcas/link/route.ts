import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { brandSlugSchema } from "@/lib/validation/admin";
import {
  saveStorefrontSlug,
  BrandStoreConfigError,
} from "@/server/services/brand-store-config-service";

/// Solo Marcolini cambia el link de una tienda que ya lo tiene (la marca lo
/// elige una sola vez). El link anterior sigue llevando al nuevo — ver
/// saveStorefrontSlug.
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = brandSlugSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await saveStorefrontSlug(parsed.data.brandId, parsed.data.slug, { byAdmin: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BrandStoreConfigError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
