import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { listCreatorPaidContentRequests } from "@/server/services/paid-content-service";

export async function GET() {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const requests = await listCreatorPaidContentRequests(profile.id);
  return NextResponse.json({ requests });
}
