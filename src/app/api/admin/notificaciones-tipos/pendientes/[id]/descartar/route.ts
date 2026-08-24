import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { discardNotification } from "@/server/services/notification-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  await discardNotification(id);
  return NextResponse.json({ ok: true });
}
