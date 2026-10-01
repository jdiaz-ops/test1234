import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { createBrandWebhook, WebhookError } from "@/server/services/webhook-service";

const createWebhookSchema = z.object({
  topic: z.string().min(1, "Elige un evento"),
  url: z.string().min(1, "Pega la URL").max(2000, "La URL es demasiado larga"),
});

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = createWebhookSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const webhook = await createBrandWebhook(profile.id, parsed.data);
    return NextResponse.json({ ok: true, webhook });
  } catch (err) {
    if (err instanceof WebhookError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
