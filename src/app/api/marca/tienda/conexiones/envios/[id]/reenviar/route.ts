import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { resendDelivery, WebhookError } from "@/server/services/webhook-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `webhook-reenviar:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const { id } = await params;
  try {
    const delivery = await resendDelivery(profile.id, id);
    return NextResponse.json({ ok: true, delivery });
  } catch (err) {
    if (err instanceof WebhookError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
