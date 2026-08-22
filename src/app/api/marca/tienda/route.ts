import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { updateStoreSchema } from "@/lib/validation/brand";
import { updateStoreConnection } from "@/server/services/brand-profile-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateStoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await updateStoreConnection(profile.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
