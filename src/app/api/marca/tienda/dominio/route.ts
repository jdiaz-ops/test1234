import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { setCustomDomainSchema } from "@/lib/validation/brand";
import {
  setCustomDomain,
  removeCustomDomain,
  CustomDomainError,
} from "@/server/services/custom-domain-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = setCustomDomainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const brand = await setCustomDomain(profile.id, parsed.data.domain);
    return NextResponse.json({
      ok: true,
      domain: brand.customDomain,
      verificationToken: brand.customDomainVerificationToken,
    });
  } catch (err) {
    if (err instanceof CustomDomainError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await removeCustomDomain(profile.id);
  return NextResponse.json({ ok: true });
}
