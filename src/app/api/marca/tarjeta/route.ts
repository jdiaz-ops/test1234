import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { saveCardSchema } from "@/lib/validation/brand";
import { saveBrandCard } from "@/server/services/payment-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = saveCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await saveBrandCard(profile.id, parsed.data);
  return NextResponse.json({ ok: true });
}
