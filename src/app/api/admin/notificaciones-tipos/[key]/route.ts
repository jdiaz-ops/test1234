import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { updateNotificationTypeConfig } from "@/server/services/notification-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { key } = await params;
  const body = await req.json();

  const data: Parameters<typeof updateNotificationTypeConfig>[1] = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.mode === "AUTOMATIC" || body.mode === "MANUAL") data.mode = body.mode;
  if (typeof body.channelApp === "boolean") data.channelApp = body.channelApp;
  if (typeof body.channelEmail === "boolean") data.channelEmail = body.channelEmail;
  if (typeof body.messageTemplate === "string") data.messageTemplate = body.messageTemplate;

  try {
    await updateNotificationTypeConfig(key, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
