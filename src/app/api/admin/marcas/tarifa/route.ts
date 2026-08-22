import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { brandFeeOverrideSchema } from "@/lib/validation/admin";
import { setBrandFeeOverride } from "@/server/services/admin-brand-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = brandFeeOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await setBrandFeeOverride(parsed.data.brandId, parsed.data.feePercent);
  return NextResponse.json({ ok: true });
}
