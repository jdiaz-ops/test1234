import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCreatorProfile } from "@/lib/current-creator";
import { SAMPLES_ENABLED } from "@/lib/features";
import { shippingAddressSchema } from "@/lib/validation/creator";
import { acceptPrBoxProposal, declinePrBoxProposal, PrBoxError } from "@/server/services/pr-box-service";

/// La creadora con una caja que le propusieron: aceptarla (con su
/// dirección) o no.
const bodySchema = z.discriminatedUnion("action", [
  shippingAddressSchema.extend({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline") }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { requestId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "accept") {
      // Sin "action": solo los datos de envío.
      await acceptPrBoxProposal(profile.id, requestId, shippingAddressSchema.parse(body));
    } else {
      await declinePrBoxProposal(profile.id, requestId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PrBoxError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
