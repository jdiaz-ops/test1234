import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { enviaAllowed } from "@/lib/features";
import { EnviaServiceError, MAX_LABELS_PER_PDF, mergedOrderLabels } from "@/server/services/envia-service";

/// Bajar las guías de Envia de cada pedido toma unos segundos.
export const maxDuration = 60;

const schema = z.object({
  orderIds: z
    .array(z.string().min(1).max(40))
    .min(1, "Elige al menos un pedido")
    .max(MAX_LABELS_PER_PDF, `Máximo ${MAX_LABELS_PER_PDF} guías por PDF`),
  /// Primero la hoja de empaque de esos pedidos y después las guías.
  conEmpaque: z.boolean().optional(),
});

/// Las guías de los pedidos elegidos en la lista (con `conEmpaque`, primero
/// su hoja de empaque), en un solo PDF para imprimir de una vez. El
/// encabezado X-Guias-Faltantes dice cuántas guías no se pudieron incluir.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!enviaAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const { pdf, missing } = await mergedOrderLabels(profile.id, parsed.data.orderIds, { packing: parsed.data.conEmpaque });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${parsed.data.conEmpaque ? "guias-y-hoja-de-empaque" : "guias-envia"}.pdf"`,
        "X-Guias-Faltantes": String(missing),
      },
    });
  } catch (err) {
    if (err instanceof EnviaServiceError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
