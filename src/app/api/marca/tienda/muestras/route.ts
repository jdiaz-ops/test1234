import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { sampleSettingsSchema } from "@/lib/validation/brand";
import {
  listBrandSampleCatalog,
  listBrandSampleRequests,
  updateProductSampleSettings,
  SampleError,
} from "@/server/services/sample-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [products, requests] = await Promise.all([
    listBrandSampleCatalog(profile.id),
    listBrandSampleRequests(profile.id),
  ]);
  return NextResponse.json({ products, requests });
}

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = sampleSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const product = await updateProductSampleSettings(profile.id, parsed.data);
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    if (err instanceof SampleError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
