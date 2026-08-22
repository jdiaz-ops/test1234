import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { sendProductSchema, markShipmentSentSchema } from "@/lib/validation/brand";
import { brandSendProduct, markShipmentSent, markShipmentDelivered, ShipmentError } from "@/server/services/shipment-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const action = body.action;

  try {
    if (action === "send") {
      const parsed = sendProductSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
      const shipment = await brandSendProduct({ ...parsed.data, brandUserId: profile.userId });
      return NextResponse.json({ ok: true, shipmentId: shipment.id }, { status: 201 });
    }

    if (action === "markSent") {
      const parsed = markShipmentSentSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
      await markShipmentSent({ ...parsed.data, brandUserId: profile.userId });
      return NextResponse.json({ ok: true });
    }

    if (action === "markDelivered") {
      if (!body.shipmentId) return NextResponse.json({ error: "Falta shipmentId" }, { status: 400 });
      await markShipmentDelivered(body.shipmentId, profile.userId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch (err) {
    if (err instanceof ShipmentError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
