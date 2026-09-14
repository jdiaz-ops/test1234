import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { updateOrderFulfillmentSchema } from "@/lib/validation/brand";
import {
  updateOrderFulfillment,
  StoreOrderError,
} from "@/server/services/store-order-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateOrderFulfillmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const order = await updateOrderFulfillment(profile.id, parsed.data);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof StoreOrderError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
