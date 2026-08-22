import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { requestInstantPayout, PaymentError } from "@/server/services/payment-service";

export async function POST() {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const result = await requestInstantPayout(profile.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
