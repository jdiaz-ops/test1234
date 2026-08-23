import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { brandMarketplaceVisibilitySchema } from "@/lib/validation/admin";
import { setBrandMarketplaceVisibility } from "@/server/services/admin-brand-service";

/// Solo el owner — es una herramienta de prueba visual, no una decisión de
/// negocio que deba quedar abierta a cualquier admin.
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = brandMarketplaceVisibilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await setBrandMarketplaceVisibility(parsed.data.brandId, parsed.data.override);
  return NextResponse.json({ ok: true });
}
