import { NextResponse } from "next/server";
import { limitOrReject } from "@/lib/rate-limit";
import { createStoreOrderSchema } from "@/lib/validation/storefront";
import { createStoreOrder, StoreOrderError } from "@/server/services/store-order-service";

/// Crea un pedido de "Mi tienda" y devuelve lo que necesita el checkout
/// para mandar a pagar con la pasarela de la marca (ver PaymentLaunch en
/// src/server/payments/types.ts) — el cargo lo hace la pasarela cuando el
/// comprador confirma.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Crear pedidos: 40 cada 10 minutos por IP (holgado por las IPs
  // compartidas de los operadores móviles). Ver src/lib/rate-limit.ts.
  const limited = await limitOrReject(req, "pedido", 40, 600);
  if (limited) return limited;

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
    const { order, payment } = await createStoreOrder(slug, {
      items: parsed.data.items,
      buyerName: parsed.data.buyerName,
      buyerEmail: parsed.data.buyerEmail,
      buyerPhone: parsed.data.buyerPhone,
      shippingAddress: parsed.data.shippingAddress || undefined,
      shippingCity: parsed.data.shippingCity || undefined,
      shippingRegion: parsed.data.shippingRegion || undefined,
      shippingNotes: parsed.data.shippingNotes || null,
      servicePreferredAt: parsed.data.servicePreferredAt || undefined,
      discountCode: parsed.data.discountCode || null,
      // Antes no se pasaba y createStoreOrder rechazaba toda compra con
      // "autoriza el tratamiento de tus datos" aunque la casilla estuviera
      // marcada. Ver conversación del 2026-10-01.
      dataConsent: parsed.data.dataConsent,
      billingIdType: parsed.data.billingIdType || undefined,
      billingIdNumber: parsed.data.billingIdNumber || undefined,
      billingName: parsed.data.billingName || undefined,
      billingAddress: parsed.data.billingAddress || undefined,
      billingCity: parsed.data.billingCity || undefined,
      billingRegion: parsed.data.billingRegion || undefined,
      buyerFirstName: parsed.data.buyerFirstName || undefined,
      buyerLastName: parsed.data.buyerLastName || undefined,
      shippingPostalCode: parsed.data.shippingPostalCode || undefined,
      acceptsMarketing: parsed.data.acceptsMarketing ?? false,
    });
    return NextResponse.json({ ok: true, orderId: order.id, payment });
  } catch (err) {
    if (err instanceof StoreOrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
