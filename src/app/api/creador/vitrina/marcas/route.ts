import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { updateEnrollmentDisplaySchema } from "@/lib/validation/creator";
import { updateEnrollmentDisplay } from "@/server/services/creator-profile-service";

export async function PATCH(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateEnrollmentDisplaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await updateEnrollmentDisplay(profile.userId, parsed.data.items);
  return NextResponse.json({ ok: true });
}
