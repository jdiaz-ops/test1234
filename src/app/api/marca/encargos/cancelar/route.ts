import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { cancelPaidContentSchema } from "@/lib/validation/brand";
import {
  cancelPaidContentRequest,
  PaidContentError,
} from "@/server/services/paid-content-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = cancelPaidContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await cancelPaidContentRequest(profile.id, parsed.data.requestId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PaidContentError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
