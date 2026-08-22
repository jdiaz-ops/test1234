import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { sendMessageSchema } from "@/lib/validation/creator";
import { sendMessage, MessageError } from "@/server/services/message-service";

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const message = await sendMessage({
      enrollmentId: parsed.data.enrollmentId,
      senderUserId: profile.userId,
      body: parsed.data.body,
    });
    return NextResponse.json({ ok: true, messageId: message.id }, { status: 201 });
  } catch (err) {
    if (err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
