import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { createLicensableContentSchema } from "@/lib/validation/creator";
import {
  listCreatorLicensableContent,
  createLicensableContent,
  ContentLicenseError,
} from "@/server/services/content-license-service";

export async function GET() {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const content = await listCreatorLicensableContent(profile.id);
  return NextResponse.json({ content });
}

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createLicensableContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const content = await createLicensableContent(profile.id, parsed.data);
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    if (err instanceof ContentLicenseError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
