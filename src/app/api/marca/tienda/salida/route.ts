import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { GO_LIVE_MANUAL_KEYS, setGoLiveCheck } from "@/server/services/go-live-service";

/// La marca marca (o desmarca) un paso de "lo que falta para vender" que
/// no se puede saber solo (ver go-live-service.ts).
const bodySchema = z.object({
  key: z.enum(["productos", "inventario", "dominio"]),
  done: z.boolean(),
});

export async function PUT(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success || !GO_LIVE_MANUAL_KEYS.includes(body.data.key)) {
    return NextResponse.json({ error: "Paso inválido." }, { status: 400 });
  }
  const checks = await setGoLiveCheck(profile.id, body.data.key, body.data.done);
  return NextResponse.json({ ok: true, checks });
}
