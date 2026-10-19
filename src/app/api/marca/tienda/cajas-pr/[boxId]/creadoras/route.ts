import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { SAMPLES_ENABLED } from "@/lib/features";
import { listProposableCreators } from "@/server/services/pr-box-service";

/// A quién se le puede proponer la caja: sus creadoras y, buscando por
/// nombre, las que se dejan encontrar. Solo nombre, foto, ciudad y redes —
/// nunca el perfil completo (trae cédula, teléfono y cuenta bancaria).
export async function GET(req: Request, { params }: { params: Promise<{ boxId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { boxId } = await params;
  const creators = await listProposableCreators(profile.id, boxId, new URL(req.url).searchParams.get("q"));
  return NextResponse.json({ creators });
}
