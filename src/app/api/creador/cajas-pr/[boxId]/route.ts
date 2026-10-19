import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCreatorProfile } from "@/lib/current-creator";
import { SAMPLES_ENABLED } from "@/lib/features";
import { shippingAddressSchema } from "@/lib/validation/creator";
import { PrBoxError, requestPrBox } from "@/server/services/pr-box-service";

/// La creadora pide una Caja PR desde el marketplace, con su dirección.
const bodySchema = shippingAddressSchema.extend({ message: z.string().max(500).optional().or(z.literal("")) });

export async function POST(req: Request, { params }: { params: Promise<{ boxId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { boxId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisa tus datos de envío." }, { status: 400 });
  const { message, ...shipping } = parsed.data;
  try {
    await requestPrBox(profile.id, boxId, shipping, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PrBoxError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
