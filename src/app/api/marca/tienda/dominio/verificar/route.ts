import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  verifyCustomDomain,
  CustomDomainError,
} from "@/server/services/custom-domain-service";

export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const brand = await verifyCustomDomain(profile.id);
    return NextResponse.json({ ok: true, verifiedAt: brand.customDomainVerifiedAt });
  } catch (err) {
    if (err instanceof CustomDomainError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
