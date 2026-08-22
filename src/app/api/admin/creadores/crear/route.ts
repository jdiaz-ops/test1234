import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { createCreatorManuallySchema } from "@/lib/validation/admin";
import { createCreatorManually, AdminCreatorError } from "@/server/services/admin-creator-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createCreatorManuallySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await createCreatorManually(parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AdminCreatorError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
