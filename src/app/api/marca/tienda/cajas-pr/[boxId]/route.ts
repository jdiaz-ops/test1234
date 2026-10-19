import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { SAMPLES_ENABLED } from "@/lib/features";
import { prBoxInputSchema } from "@/lib/pr-box";
import { deletePrBox, PrBoxError, setPrBoxStatus, updatePrBox } from "@/server/services/pr-box-service";

/// Editar una Caja PR (todo el formulario) o solo cambiarle el estado
/// (activar, cerrar), y borrarla si nadie la tiene aprobada.
const statusOnly = z.object({ status: z.enum(["DRAFT", "OPEN", "CLOSED"]) }).strict();

export async function PATCH(req: Request, { params }: { params: Promise<{ boxId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { boxId } = await params;
  const body = await req.json().catch(() => null);
  try {
    const status = statusOnly.safeParse(body);
    if (status.success) {
      await setPrBoxStatus(profile.id, boxId, status.data.status);
      return NextResponse.json({ ok: true });
    }
    const parsed = prBoxInputSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos de la caja." }, { status: 400 });
    await updatePrBox(profile.id, boxId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PrBoxError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ boxId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { boxId } = await params;
  try {
    await deletePrBox(profile.id, boxId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PrBoxError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
