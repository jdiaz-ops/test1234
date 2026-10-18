import { NextResponse } from "next/server";
import { z } from "zod";
import { limitOrReject } from "@/lib/rate-limit";
import { AdminBrandError, claimBrandAccess } from "@/server/services/admin-brand-service";

/// La dueña reclama su marca con el link de acceso: correo + contraseña
/// (ver claimBrandAccess). Público, con límite de intentos por IP.
const bodySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
});

export async function POST(req: Request) {
  const limited = await limitOrReject(req, "activar-marca", 20, 3600);
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  try {
    const result = await claimBrandAccess(parsed.data.token, { email: parsed.data.email, password: parsed.data.password });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AdminBrandError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
