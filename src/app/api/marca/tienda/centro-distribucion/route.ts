import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { distributionCenterSchema } from "@/lib/validation/brand";
import { saveDistributionCenter } from "@/server/services/brand-store-config-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = distributionCenterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  await saveDistributionCenter(profile.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
