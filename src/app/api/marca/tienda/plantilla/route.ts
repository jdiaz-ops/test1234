import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { setStorefrontTemplateSchema } from "@/lib/validation/brand";
import { saveStorefrontTemplate } from "@/server/services/brand-store-config-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = setStorefrontTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  await saveStorefrontTemplate(profile.userId, parsed.data.template);
  return NextResponse.json({ ok: true });
}
