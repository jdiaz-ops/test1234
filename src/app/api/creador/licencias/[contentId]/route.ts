import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { updateLicensableContentSchema } from "@/lib/validation/creator";
import {
  updateLicensableContent,
  ContentLicenseError,
} from "@/server/services/content-license-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const profile = await requireCreatorProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { contentId } = await params;
  const body = await req.json();
  const parsed = updateLicensableContentSchema.safeParse({ ...body, contentId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const content = await updateLicensableContent(profile.id, parsed.data);
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    if (err instanceof ContentLicenseError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
