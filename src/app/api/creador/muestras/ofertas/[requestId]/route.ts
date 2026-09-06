import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { acceptSampleOfferSchema } from "@/lib/validation/creator";
import {
  acceptSampleOffer,
  declineSampleOffer,
  SampleError,
} from "@/server/services/sample-service";

/// Respuesta del creador a una oferta de muestra que le mandó una marca
/// (push, ver sample-service.ts). `decision` viaja junto al body de envío
/// solo cuando es "accept" — en "decline" no hace falta nada más.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { requestId } = await params;
  const body = await req.json();

  try {
    if (body.decision === "decline") {
      const updated = await declineSampleOffer(profile.id, requestId);
      return NextResponse.json({ ok: true, request: updated });
    }

    const parsed = acceptSampleOfferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }
    const updated = await acceptSampleOffer(profile.id, requestId, parsed.data);
    return NextResponse.json({ ok: true, request: updated });
  } catch (err) {
    if (err instanceof SampleError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
