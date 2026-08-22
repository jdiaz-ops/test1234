import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { broadcastSchema } from "@/lib/validation/admin";
import { sendBroadcast, BroadcastError } from "@/server/services/broadcast-service";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = broadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await sendBroadcast({ ...parsed.data, sentByUserId: admin.id });
    return NextResponse.json({ ok: true, recipientCount: result.recipientCount });
  } catch (err) {
    if (err instanceof BroadcastError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
