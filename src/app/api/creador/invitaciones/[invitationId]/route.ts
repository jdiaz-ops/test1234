import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { respondInvitationSchema } from "@/lib/validation/creator";
import {
  respondToInvitation,
  RecruitError,
} from "@/server/services/recruit-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { invitationId } = await params;
  const body = await req.json();
  const parsed = respondInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const updated = await respondToInvitation(
      profile.id,
      invitationId,
      parsed.data.decision,
      parsed.data.desiredCode,
    );
    return NextResponse.json({ ok: true, invitation: updated });
  } catch (err) {
    if (err instanceof RecruitError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
