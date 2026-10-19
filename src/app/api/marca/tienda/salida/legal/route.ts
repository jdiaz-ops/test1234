import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { GoLiveStepError, saveLegalStep } from "@/server/services/go-live-service";

/// "Completa razón social y NIT" desde el Dashboard (ver go-live-steps.tsx).
const bodySchema = z.object({ legalName: z.string().max(200), taxId: z.string().max(40) });

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Escribe la razón social y el NIT." }, { status: 400 });
  try {
    await saveLegalStep(profile.id, body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GoLiveStepError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
