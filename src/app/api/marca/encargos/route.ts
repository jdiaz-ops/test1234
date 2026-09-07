import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { requestPaidContentSchema } from "@/lib/validation/brand";
import {
  listBrandPaidContentRequests,
  requestPaidContent,
  PaidContentError,
} from "@/server/services/paid-content-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const requests = await listBrandPaidContentRequests(profile.id);
  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = requestPaidContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const request = await requestPaidContent(profile.id, parsed.data);
    return NextResponse.json({ ok: true, request });
  } catch (err) {
    if (err instanceof PaidContentError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
