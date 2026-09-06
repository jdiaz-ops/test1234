import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { listBrandLicenses } from "@/server/services/content-license-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const licenses = await listBrandLicenses(profile.id);
  return NextResponse.json({ licenses });
}
