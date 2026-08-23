import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { updateStorefrontSchema } from "@/lib/validation/creator";
import { updateStorefrontSettings } from "@/server/services/creator-profile-service";

export async function PATCH(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateStorefrontSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await updateStorefrontSettings(profile.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
