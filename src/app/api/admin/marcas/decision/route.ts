import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { brandDecisionSchema } from "@/lib/validation/admin";
import {
  approveBrand,
  rejectBrand,
  pauseBrand,
  reactivateBrand,
} from "@/server/services/admin-brand-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = brandDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { brandId, decision } = parsed.data;
  const action = { APPROVE: approveBrand, REJECT: rejectBrand, PAUSE: pauseBrand, REACTIVATE: reactivateBrand }[
    decision
  ];
  await action(brandId);

  return NextResponse.json({ ok: true });
}
