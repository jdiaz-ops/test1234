import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { requestSampleSchema } from "@/lib/validation/creator";
import {
  listSampleEligibleProducts,
  listCreatorSampleRequests,
  listCreatorSampleOffers,
  createSampleRequest,
  SampleError,
} from "@/server/services/sample-service";

export async function GET() {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [products, requests, offers] = await Promise.all([
    listSampleEligibleProducts(),
    listCreatorSampleRequests(profile.id),
    listCreatorSampleOffers(profile.id),
  ]);
  return NextResponse.json({ products, requests, offers });
}

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = requestSampleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const request = await createSampleRequest(profile.id, parsed.data);
    return NextResponse.json({ ok: true, request });
  } catch (err) {
    if (err instanceof SampleError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
