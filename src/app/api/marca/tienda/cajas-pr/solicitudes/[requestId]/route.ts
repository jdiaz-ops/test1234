import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { SAMPLES_ENABLED } from "@/lib/features";
import { markPrBoxShipped, PrBoxError, respondToPrBoxRequest } from "@/server/services/pr-box-service";

/// La marca con una creadora: aprobar o rechazar lo que pidió, o marcar la
/// caja como enviada con su guía.
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(300).optional().or(z.literal("")) }),
  z.object({ action: z.literal("ship"), carrier: z.string().max(80).optional().or(z.literal("")), trackingNumber: z.string().max(80).optional().or(z.literal("")) }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  if (!SAMPLES_ENABLED) return NextResponse.json({ error: "Las muestras no están disponibles todavía." }, { status: 404 });
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { requestId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "ship") await markPrBoxShipped(profile.id, requestId, { carrier: body.carrier, trackingNumber: body.trackingNumber });
    else await respondToPrBoxRequest(profile.id, requestId, body.action === "approve" ? "APPROVED" : "REJECTED", body.action === "reject" ? body.reason : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PrBoxError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
