import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { publishTheme } from "@/server/services/brand-theme-service";

export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const theme = await publishTheme(profile.id);
  return NextResponse.json({ ok: true, theme });
}
