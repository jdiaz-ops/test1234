import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { listCreatorLicenses } from "@/server/services/content-license-service";

/// Licencias que marcas ya le alquilaron a este creador — de solo lectura,
/// el pago real corre por el motor de payoutCreator normal.
export async function GET() {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const licenses = await listCreatorLicenses(profile.id);
  return NextResponse.json({ licenses });
}
