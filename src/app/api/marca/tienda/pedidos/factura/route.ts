import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { dataicoAllowed } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { issueOrderInvoice } from "@/server/services/dataico-service";

const schema = z.object({ orderId: z.string().min(1) });

/// "Emitir factura" / "Reintentar" en el detalle del pedido.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!dataicoAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  const order = await prisma.storeOrder.findFirst({
    where: { id: parsed.data.orderId, brandId: profile.id },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const result = await issueOrderInvoice(order.id);
  if (result.status === "SKIPPED") {
    return NextResponse.json(
      { error: "Este pedido no se puede facturar ahora: revisa que la conexión con Dataico esté activa y el pedido pagado." },
      { status: 400 },
    );
  }
  if (result.status === "FAILED") return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
