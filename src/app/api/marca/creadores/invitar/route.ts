import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { inviteCreatorSchema } from "@/lib/validation/brand";
import {
  inviteCreatorToOffer,
  RecruitError,
} from "@/server/services/recruit-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = inviteCreatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const invitation = await inviteCreatorToOffer(profile.id, {
      offerId: parsed.data.offerId,
      creatorId: parsed.data.creatorId,
      commissionPercentOverride: parsed.data.commissionPercentOverride,
      discountPercentOverride: parsed.data.discountPercentOverride,
      message: parsed.data.message,
    });
    return NextResponse.json({ ok: true, invitation });
  } catch (err) {
    if (err instanceof RecruitError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
