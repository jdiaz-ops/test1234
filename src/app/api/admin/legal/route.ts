import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { legalContentSchema } from "@/lib/validation/admin";
import { upsertLegalContent } from "@/server/services/admin-config-service";

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = legalContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await upsertLegalContent(parsed.data.key, parsed.data.title, parsed.data.body);
  return NextResponse.json({ ok: true });
}
