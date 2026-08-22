import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { fraudReviewSchema } from "@/lib/validation/admin";
import { reviewFraudFlag } from "@/server/services/admin-fraud-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = fraudReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await reviewFraudFlag(parsed.data.flagId, parsed.data.status);
  return NextResponse.json({ ok: true });
}
