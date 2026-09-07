import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { respondPaidContentRequestSchema } from "@/lib/validation/creator";
import {
  respondToPaidContentRequest,
  PaidContentError,
} from "@/server/services/paid-content-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { requestId } = await params;
  const body = await req.json();
  const parsed = respondPaidContentRequestSchema.safeParse({ ...body, requestId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const request = await respondToPaidContentRequest(
      profile.id,
      parsed.data.requestId,
      parsed.data.decision,
    );
    return NextResponse.json({ ok: true, request });
  } catch (err) {
    if (err instanceof PaidContentError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
