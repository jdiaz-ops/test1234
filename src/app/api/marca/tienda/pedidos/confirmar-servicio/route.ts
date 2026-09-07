import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { confirmServiceBookingSchema } from "@/lib/validation/brand";
import {
  confirmServiceBooking,
  StoreOrderError,
} from "@/server/services/store-order-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = confirmServiceBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const item = await confirmServiceBooking(profile.id, parsed.data);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof StoreOrderError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
