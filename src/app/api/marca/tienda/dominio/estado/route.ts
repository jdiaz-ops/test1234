import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { getCustomDomainStatus } from "@/server/services/custom-domain-service";

/// Estado del dominio propio: si ya está registrado en Vercel, si el DNS
/// ya apunta y qué registros poner (ver custom-domain-service.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await getCustomDomainStatus(profile.id)) });
}
