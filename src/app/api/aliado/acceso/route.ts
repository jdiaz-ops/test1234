import { NextResponse } from "next/server";
import { z } from "zod";
import { limitOrReject } from "@/lib/rate-limit";
import { requestAllyLoginLink } from "@/server/services/ally-service";

/// El aliado pide el link para entrar a su portal (sin contraseña). Siempre
/// responde lo mismo, sea o no el correo de un aliado.
export async function POST(req: Request) {
  const limited = await limitOrReject(req, "aliado-acceso", 8, 900);
  if (limited) return limited;
  const body = z.object({ email: z.string().trim().email().max(200) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Escribe tu correo." }, { status: 400 });
  try {
    await requestAllyLoginLink(body.data.email);
  } catch (err) {
    console.error("[aliado-acceso]", err);
  }
  return NextResponse.json({ ok: true });
}
