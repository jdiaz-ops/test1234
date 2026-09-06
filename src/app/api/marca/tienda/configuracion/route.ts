import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { storeConfigSchema } from "@/lib/validation/brand";
import {
  saveStorefrontSlug,
  BrandStoreConfigError,
} from "@/server/services/brand-store-config-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = storeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await saveStorefrontSlug(
      profile.userId,
      profile.id,
      parsed.data.storefrontSlug,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BrandStoreConfigError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
