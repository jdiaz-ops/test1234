import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { enviaAllowed } from "@/lib/features";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import {
  EnviaServiceError,
  cancelOrderLabel,
  createOrderLabel,
  quoteOrderShipping,
  refreshOrderTracking,
} from "@/server/services/envia-service";

/// Cotizar con todas las transportadoras puede tardar unos segundos.
export const maxDuration = 60;

const size = (label: string, max: number) =>
  z.number().int(`${label}: escribe un número entero`).min(1, `${label}: tiene que ser mayor a 0`).max(max, `${label}: es demasiado`);

const orderId = z.string().min(1).max(40);

const labelShape = {
  orderId,
  packageLengthCm: size("Largo", 300),
  packageWidthCm: size("Ancho", 300),
  packageHeightCm: size("Alto", 300),
  packageWeightGrams: size("Peso", 100_000),
  declaredValue: z.number().min(0, "El valor declarado no puede ser negativo").max(100_000_000),
  destination: z.object({
    street: z.string().trim().min(5, "Escribe la dirección completa del destino").max(200),
    region: z.enum(COLOMBIA_REGIONS, "Elige el departamento del destino"),
    city: z.string().trim().min(2, "Escribe la ciudad del destino").max(80),
    reference: z.string().trim().max(120).nullable().optional(),
  }),
};

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cotizar"), ...labelShape }),
  z.object({
    action: z.literal("crear"),
    ...labelShape,
    carrier: z.string().trim().min(1).max(40),
    service: z.string().trim().min(1).max(80),
    priceCents: z.number().int().nonnegative().optional(),
  }),
  z.object({ action: z.literal("estado"), orderId }),
  z.object({ action: z.literal("anular"), orderId }),
]);

/// Guía con Envia desde el detalle del pedido: cotizar, crear, actualizar
/// el estado o anular. Ver envia-service.ts.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!enviaAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const body = parsed.data;

  try {
    switch (body.action) {
      case "cotizar":
        return NextResponse.json(await quoteOrderShipping(profile.id, body.orderId, body));
      case "crear":
        return NextResponse.json(await createOrderLabel(profile.id, body.orderId, body));
      case "estado":
        return NextResponse.json(await refreshOrderTracking(profile.id, body.orderId));
      case "anular":
        return NextResponse.json(await cancelOrderLabel(profile.id, body.orderId));
    }
  } catch (err) {
    if (err instanceof EnviaServiceError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
