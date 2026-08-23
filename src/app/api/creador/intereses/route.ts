import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { updateInterestsSchema } from "@/lib/validation/creator";
import { replaceCreatorInterests } from "@/server/services/creator-profile-service";

export async function PATCH(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateInterestsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await replaceCreatorInterests(profile.userId, parsed.data.verticalIds);
  return NextResponse.json({ ok: true });
}
