import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { deleteBrandWebhook, WebhookError } from "@/server/services/webhook-service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteBrandWebhook(profile.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WebhookError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
