import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { respondSampleRequestSchema } from "@/lib/validation/brand";
import {
  respondToSampleRequest,
  SampleError,
} from "@/server/services/sample-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { requestId } = await params;
  const body = await req.json();
  const parsed = respondSampleRequestSchema.safeParse({
    ...body,
    requestId,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const updated = await respondToSampleRequest(
      profile.id,
      parsed.data.requestId,
      parsed.data.decision,
      parsed.data.rejectedReason,
    );
    return NextResponse.json({ ok: true, request: updated });
  } catch (err) {
    if (err instanceof SampleError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
