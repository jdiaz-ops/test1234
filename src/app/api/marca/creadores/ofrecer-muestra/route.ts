import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { offerSampleToCreatorSchema } from "@/lib/validation/brand";
import {
  offerSampleToCreator,
  SampleError,
} from "@/server/services/sample-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = offerSampleToCreatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const request = await offerSampleToCreator(profile.id, parsed.data);
    return NextResponse.json({ ok: true, request });
  } catch (err) {
    if (err instanceof SampleError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
