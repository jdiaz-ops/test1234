import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { forceCompleteBrandOnboarding } from "@/server/services/onboarding-service";

/// Solo para demostración — fuerza a completo el onboarding de una marca
/// (perfil, tienda, cómo-te-cobramos, oferta) para poder ver el portal y el
/// marketplace en su estado "en vivo" sin llenar el wizard paso a paso.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { brandId } = await req.json();
  if (typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ error: "Falta la marca" }, { status: 400 });
  }

  await forceCompleteBrandOnboarding(brandId);
  return NextResponse.json({ ok: true });
}
