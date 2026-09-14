import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { getDraftTheme, updateDraftTheme } from "@/server/services/brand-theme-service";

/// Editor de Diseño — GET trae el borrador (lo que la marca está
/// tocando), PATCH aplica un patch parcial sobre él. Nunca toca lo
/// publicado (ver /api/marca/tienda/diseno/publicar). Ver conversación
/// del 2026-09-14, recorrido completo del editor de Tiendanube.
export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const theme = await getDraftTheme(profile.id);
  return NextResponse.json({ theme });
}

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Patch inválido." }, { status: 400 });
  }

  try {
    const theme = await updateDraftTheme(profile.id, body);
    return NextResponse.json({ ok: true, theme });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }
    throw err;
  }
}
