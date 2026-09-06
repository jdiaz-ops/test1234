import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { listCreatorInvitations } from "@/server/services/recruit-service";

export async function GET() {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const invitations = await listCreatorInvitations(profile.id);
  return NextResponse.json({ invitations });
}
