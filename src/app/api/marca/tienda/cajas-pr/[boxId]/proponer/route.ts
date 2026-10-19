import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { SAMPLES_ENABLED } from "@/lib/features";
import { PrBoxError, proposePrBox } from "@/server/services/pr-box-service";

const bodySchema = z.object({
  creatorIds: z.array(z.string().min(1)).min(1, "Elige al menos una creadora.").max(50, "Hasta 50 creadoras a la vez."),
  message: z.string().max(500).optional().or(z.literal("")),
});

export async function POST(req: Request, { params }: { params: Promise<{ boxId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { boxId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await proposePrBox(profile.id, boxId, parsed.data.creatorIds, parsed.data.message)) });
  } catch (err) {
    if (err instanceof PrBoxError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
