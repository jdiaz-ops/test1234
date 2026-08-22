import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { joinOfferSchema } from "@/lib/validation/creator";
import { joinOffer, MarketplaceError } from "@/server/services/marketplace-service";

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = joinOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const enrollment = await joinOffer(profile.id, parsed.data.offerId);
    return NextResponse.json({ ok: true, status: enrollment.status });
  } catch (err) {
    if (err instanceof MarketplaceError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo completar la unión." }, { status: 500 });
  }
}
