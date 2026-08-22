import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/server/services/notification-service";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.notificationId) {
    await markNotificationRead(session.user.id, body.notificationId);
  } else {
    await markAllNotificationsRead(session.user.id);
  }

  return NextResponse.json({ ok: true });
}
