import { NextResponse } from "next/server";
import { createStoreOrderSchema } from "@/lib/validation/storefront";
import {
  createStoreOrder,
  StoreOrderError,
} from "@/server/services/store-order-service";

/// Crea un pedido de "Mi tienda" y devuelve lo que necesita el botón de
/// Wompi para cobrar — nunca crea el cargo acá, eso lo hace Wompi mismo
/// cuando el comprador confirma en su widget.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const body = await req.json();
  const parsed = createStoreOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const { order, wompi } = await createStoreOrder(slug, {
      items: parsed.data.items,
      buyerName: parsed.data.buyerName,
      buyerEmail: parsed.data.buyerEmail,
      buyerPhone: parsed.data.buyerPhone,
      shippingAddress: parsed.data.shippingAddress,
      shippingCity: parsed.data.shippingCity,
      shippingNotes: parsed.data.shippingNotes || null,
      discountCode: parsed.data.discountCode || null,
    });
    return NextResponse.json({ ok: true, orderId: order.id, wompi });
  } catch (err) {
    if (err instanceof StoreOrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
