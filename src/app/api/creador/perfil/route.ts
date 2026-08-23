import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { updateProfileSchema } from "@/lib/validation/creator";
import { updateCreatorProfile, replaceSocialLinks } from "@/server/services/creator-profile-service";

export async function PATCH(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { socialLinks, ...rest } = parsed.data;

  await updateCreatorProfile(profile.userId, rest);
  if (socialLinks !== undefined) {
    await replaceSocialLinks(profile.userId, socialLinks);
  }

  return NextResponse.json({ ok: true });
}
