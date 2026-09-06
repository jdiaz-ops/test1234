import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { rentContentLicenseSchema } from "@/lib/validation/brand";
import {
  rentContentLicense,
  ContentLicenseError,
} from "@/server/services/content-license-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = rentContentLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const license = await rentContentLicense(profile.id, parsed.data);
    return NextResponse.json({ ok: true, license });
  } catch (err) {
    if (err instanceof ContentLicenseError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
