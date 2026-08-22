import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { creatorSuspendSchema } from "@/lib/validation/admin";
import { setCreatorSuspended } from "@/server/services/admin-creator-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = creatorSuspendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await setCreatorSuspended(parsed.data.creatorId, parsed.data.suspended);
  return NextResponse.json({ ok: true });
}
