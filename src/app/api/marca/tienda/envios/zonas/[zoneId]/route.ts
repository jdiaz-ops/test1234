import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { shippingZoneSchema } from "@/lib/validation/brand";
import {
  updateShippingZone,
  deleteShippingZone,
  ShippingZoneError,
} from "@/server/services/shipping-zone-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ zoneId: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { zoneId } = await params;
  const body = await req.json();
  const parsed = shippingZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const zone = await updateShippingZone(profile.id, zoneId, parsed.data);
    return NextResponse.json({ ok: true, zone });
  } catch (err) {
    if (err instanceof ShippingZoneError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ zoneId: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { zoneId } = await params;

  try {
    await deleteShippingZone(profile.id, zoneId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ShippingZoneError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
