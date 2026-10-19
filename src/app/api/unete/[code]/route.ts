import { NextResponse } from "next/server";
import { z } from "zod";
import { limitOrReject } from "@/lib/rate-limit";
import { AllyError, createAllyLead } from "@/server/services/ally-service";

/// La solicitud que deja una marca o creadora por el link de un aliado
/// (marcolini.lat/unete/{code}, ver ally-service.ts). Pública: con límite
/// de intentos por IP y la autorización de datos obligatoria.
const text = (max: number) => z.string().trim().max(max);

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BRAND"),
    name: text(120).min(2, "Escribe el nombre de la marca."),
    contactName: text(120).min(2, "Escribe tu nombre."),
    phone: text(40).min(7, "Escribe tu celular."),
    instagram: text(200).min(2, "Escribe el Instagram o la web de la marca."),
    consent: z.literal(true, { message: "Acepta la autorización de datos para seguir." }),
  }),
  z.object({
    kind: z.literal("CREATOR"),
    name: text(120).min(2, "Escribe tu nombre."),
    phone: text(40).min(7, "Escribe tu celular."),
    instagram: text(200).min(2, "Escribe tu Instagram."),
    city: text(80).min(2, "Escribe tu ciudad."),
    consent: z.literal(true, { message: "Acepta la autorización de datos para seguir." }),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const limited = await limitOrReject(req, "unete", 10, 3600);
  if (limited) return limited;
  const { code } = await params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Revisa los datos." }, { status: 400 });
  try {
    await createAllyLead(code, body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AllyError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("[unete]", err);
    return NextResponse.json({ error: "No pudimos guardar tu solicitud. Intenta de nuevo." }, { status: 500 });
  }
}
