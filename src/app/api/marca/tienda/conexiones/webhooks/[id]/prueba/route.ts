import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { sendTestWebhook, WebhookError } from "@/server/services/webhook-service";

/// "Enviar prueba" — un pedido o cliente de ejemplo, marcado como prueba.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `webhook-prueba:${profile.id}`, 20, 3600);
  if (limited) return limited;

  const { id } = await params;
  try {
    const delivery = await sendTestWebhook(profile.id, id);
    return NextResponse.json({ ok: true, delivery });
  } catch (err) {
    if (err instanceof WebhookError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
