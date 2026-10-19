import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { SAMPLES_ENABLED } from "@/lib/features";
import { prBoxInputSchema } from "@/lib/pr-box";
import { createPrBox } from "@/server/services/pr-box-service";

/// Crear una Caja PR (ver pr-box-service.ts). Va con Muestras: si están
/// apagadas (SAMPLES_ENABLED), tampoco hay cajas.
export async function POST(req: Request) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = prBoxInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos de la caja." }, { status: 400 });
  const box = await createPrBox(profile.id, parsed.data);
  return NextResponse.json({ ok: true, box: { id: box.id } });
}
