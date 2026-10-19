import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { getCustomDomainStatus, refreshCustomDomain } from "@/server/services/custom-domain-service";

/// Estado del dominio propio: si ya abre la tienda (activo), si está
/// registrado en Vercel, si el DNS ya apunta y qué registros poner (ver
/// custom-domain-service.ts). Al abrir Configuración, si todavía espera el
/// DNS, se revisa una vez de una; con "Revisar conexión" (?revisar=1) se
/// revisa siempre, también si ya estaba activo.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const asked = new URL(req.url).searchParams.get("revisar") === "1";
  const pending = Boolean(profile.customDomain && profile.customDomainVerifiedAt && !profile.customDomainActiveAt);
  if (asked || pending) {
    await refreshCustomDomain(profile.id, asked ? {} : { attempts: 1 }).catch((err) => console.error("[dominio] revisar:", err));
  }
  return NextResponse.json({ ok: true, ...(await getCustomDomainStatus(profile.id)) });
}
