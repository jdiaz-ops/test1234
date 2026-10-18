import { NextResponse } from "next/server";
import { flattenQuery, loadOrderForReturn, settleOrderFromReturn } from "@/server/payments/return-check";

/// Respaldo de la página "gracias por tu compra": la pasarela devuelve al
/// comprador con el id de su cobro en la URL (?id= Wompi, ?payment_id=
/// Mercado Pago, ?ref_payco= ePayco, la firma de PayU…), que suele llegar
/// antes que el aviso. Si el pedido sigue PENDING, se consulta ese cobro
/// directo contra la pasarela para no dejar al comprador esperando.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const order = await loadOrderForReturn(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  const query = flattenQuery(new URL(req.url).searchParams);
  const settled = await settleOrderFromReturn(order, order.brand, query);
  if (!settled) return NextResponse.json({ status: order.status });
  const fresh = await loadOrderForReturn(orderId);
  return NextResponse.json({ status: fresh?.status ?? order.status });
}
