import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { platformConfigSchema } from "@/lib/validation/admin";
import { updatePlatformConfig } from "@/server/services/admin-config-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "Solo el propietario puede cambiar la configuración global." }, { status: 403 });
  }

  const body = await req.json();
  const parsed = platformConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await updatePlatformConfig(parsed.data);
  return NextResponse.json({ ok: true });
}
