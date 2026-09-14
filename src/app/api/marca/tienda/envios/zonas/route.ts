import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { shippingZoneSchema } from "@/lib/validation/brand";
import {
  listShippingZones,
  createShippingZone,
  ShippingZoneError,
} from "@/server/services/shipping-zone-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const zones = await listShippingZones(profile.id);
  return NextResponse.json({ zones });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = shippingZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const zone = await createShippingZone(profile.id, parsed.data);
    return NextResponse.json({ ok: true, zone });
  } catch (err) {
    if (err instanceof ShippingZoneError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
