import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { refundOrderSchema } from "@/lib/validation/brand";
import { refundStoreOrder, StoreOrderError } from "@/server/services/store-order-service";

/// "Registrar devolución" en el detalle del pedido. Ver refundStoreOrder.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = refundOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const order = await refundStoreOrder(profile.id, parsed.data);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof StoreOrderError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[pedidos] devolución falló", err);
    return NextResponse.json(
      { error: "No se pudo registrar la devolución. Intenta de nuevo en un momento." },
      { status: 500 },
    );
  }
}
