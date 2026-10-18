import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { applyExtractedProfile } from "@/server/services/brand-profile-import-service";

/// Guarda en el perfil de la marca los datos leídos de su tienda anterior
/// (ver perfil/leer): solo los campos que estén vacíos. El sitio web
/// queda con el link de la tienda en Marcolini.
export const maxDuration = 30;

const bodySchema = z.object({
  fields: z.object({
    legalName: z.string().max(120).nullable(),
    taxId: z.string().max(30).nullable(),
    fiscalAddress: z.string().max(200).nullable(),
    city: z.string().max(80).nullable(),
    email: z.string().max(120).nullable(),
    phone: z.string().max(40).nullable(),
    description: z.string().max(400).nullable(),
  }),
});

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  const limited = await limitOrReject(req, `perfil-importar:${profile.id}`, 60, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const result = await applyExtractedProfile(profile.id, body.data.fields);
  return NextResponse.json({ ok: true, ...result });
}
