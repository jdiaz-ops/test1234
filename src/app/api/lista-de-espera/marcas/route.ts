import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { limitOrReject } from "@/lib/rate-limit";
import { brandWaitlistSchema, parseAttributionCookie, UTM_COOKIE } from "@/lib/waitlist";
import { joinBrandWaitlist } from "@/server/services/waitlist-service";

/// Formulario público de lista de espera (marcas). Ver
/// waitlist-service.ts.
export async function POST(req: Request) {
  // 10 por hora por IP: es un formulario de una sola vez.
  const limited = await limitOrReject(req, "lista-de-espera", 10, 3600);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = brandWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const attribution = parseAttributionCookie((await cookies()).get(UTM_COOKIE)?.value);
  try {
    const result = await joinBrandWaitlist(parsed.data, attribution);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[lista-de-espera/marcas]", err);
    return NextResponse.json({ error: "No pudimos guardar tus datos. Intenta de nuevo." }, { status: 500 });
  }
}
