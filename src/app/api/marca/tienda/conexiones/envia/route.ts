import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { enviaAllowed } from "@/lib/features";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { ENVIA_CO_CARRIERS } from "@/lib/envia-carriers";
import { EnviaServiceError, deleteEnviaConnection, saveEnviaConnection } from "@/server/services/envia-service";

const size = (label: string, max: number) =>
  z.number().int(`${label}: escribe un número entero`).min(1, `${label}: tiene que ser mayor a 0`).max(max, `${label}: es demasiado`);

const schema = z.object({
  /// Vacío = conservar la llave guardada.
  apiToken: z.string().trim().max(2000).optional(),
  sandbox: z.boolean(),
  originName: z.string().trim().min(2, "Escribe quién despacha").max(80),
  originCompany: z.string().trim().max(80).nullable().optional(),
  originIdNumber: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v.replace(/[^0-9a-z]/gi, "").length >= 5, "Escribe el NIT o la cédula de quien envía"),
  originPhone: z.string().trim().min(7, "Escribe el celular de quien despacha").max(20),
  originEmail: z.string().trim().max(120).nullable().optional(),
  originStreet: z.string().trim().min(5, "Escribe la dirección de despacho").max(200),
  originRegion: z.enum(COLOMBIA_REGIONS, "Elige el departamento"),
  originCity: z.string().trim().min(2, "Escribe la ciudad de despacho").max(80),
  originReference: z.string().trim().max(120).nullable().optional(),
  /// Solo esta transportadora; null = todas las de la cuenta.
  carrier: z.enum(ENVIA_CO_CARRIERS.map((c) => c.code), "Elige una transportadora de la lista").nullable().optional(),
  packageLengthCm: size("Largo", 300),
  packageWidthCm: size("Ancho", 300),
  packageHeightCm: size("Alto", 300),
  packageWeightGrams: size("Peso", 100_000),
  packageContent: z.string().trim().min(3, "Escribe qué contiene el paquete").max(60),
});

/// Guardar la conexión con Envia (Tienda → Conexiones). Prueba la llave
/// antes de guardar.
export async function PUT(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!enviaAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const result = await saveEnviaConnection(profile.id, { ...parsed.data, apiToken: parsed.data.apiToken || undefined });
    return NextResponse.json({ ok: true, carriers: result.carriers, verified: result.verified });
  } catch (err) {
    if (err instanceof EnviaServiceError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!enviaAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await deleteEnviaConnection(profile.id);
  return NextResponse.json({ ok: true });
}
