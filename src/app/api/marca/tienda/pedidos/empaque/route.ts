import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { MAX_PACKING_ORDERS, PackingSlipError, packingSlipsPdf } from "@/server/services/packing-slip-service";

const schema = z.object({
  orderIds: z
    .array(z.string().min(1).max(40))
    .min(1, "Elige al menos un pedido")
    .max(MAX_PACKING_ORDERS, `Máximo ${MAX_PACKING_ORDERS} pedidos por hoja de empaque`),
});

/// Hoja de empaque de los pedidos elegidos en la lista (ver
/// packing-slip-service.ts), en PDF para imprimir.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  try {
    const pdf = await packingSlipsPdf(profile.id, parsed.data.orderIds);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="hoja-de-empaque.pdf"',
      },
    });
  } catch (err) {
    if (err instanceof PackingSlipError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
