import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { wompiCredentialsSchema } from "@/lib/validation/brand";
import { saveWompiCredentials } from "@/server/services/brand-payment-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = wompiCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  await saveWompiCredentials(profile.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
