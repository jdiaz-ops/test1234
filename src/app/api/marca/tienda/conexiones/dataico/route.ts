import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  DataicoError,
  deleteDataicoConnection,
  saveDataicoConnection,
} from "@/server/services/dataico-service";

const dataicoSchema = z.object({
  accountId: z.string().trim().min(1, "Pega el Account ID de Dataico").max(100),
  /// Vacío = conservar el token guardado.
  authToken: z.string().trim().max(500).optional(),
  env: z.enum(["PRUEBAS", "PRODUCCION"]),
  prefix: z.string().trim().max(20).nullable().optional(),
  resolutionNumber: z.string().trim().max(40).nullable().optional(),
  nextNumber: z.number().int().positive("El siguiente número tiene que ser mayor a 0").nullable().optional(),
  sendEmail: z.boolean(),
  enabled: z.boolean(),
});

export async function PUT(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = dataicoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    await saveDataicoConnection(profile.id, { ...parsed.data, authToken: parsed.data.authToken || undefined });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DataicoError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await deleteDataicoConnection(profile.id);
  return NextResponse.json({ ok: true });
}
