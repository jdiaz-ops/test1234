import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { offerSchema, updateOfferSchema } from "@/lib/validation/brand";
import { createOffer, updateOffer } from "@/server/services/offer-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = offerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const offer = await createOffer(profile.id, parsed.data);
  return NextResponse.json({ ok: true, offerId: offer.id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { offerId, ...rest } = body;
  const parsed = updateOfferSchema.safeParse(rest);
  if (!parsed.success || !offerId) {
    return NextResponse.json({ error: parsed.success ? "Falta offerId" : parsed.error.issues[0].message }, { status: 400 });
  }

  await updateOffer(profile.id, offerId, parsed.data);
  return NextResponse.json({ ok: true });
}
