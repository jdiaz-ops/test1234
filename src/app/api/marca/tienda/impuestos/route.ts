import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { taxConfigSchema } from "@/lib/validation/brand";
import {
  saveTaxConfig,
  BrandStoreConfigError,
} from "@/server/services/brand-store-config-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = taxConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await saveTaxConfig(profile.userId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BrandStoreConfigError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
