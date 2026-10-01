import { NextResponse } from "next/server";
import { limitOrReject } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { quoteShippingSchema } from "@/lib/validation/storefront";
import { quoteShipping } from "@/server/services/store-order-service";

const REASON_MESSAGE: Record<string, string> = {
  NO_ZONES: "Esta tienda todavía no configuró sus zonas de envío.",
  NO_ZONE_MATCH: "Todavía no hacemos envíos a tu departamento.",
  NO_RATE_MATCH: "No hay una tarifa de envío que aplique a tu pedido.",
};

/// Cotiza el envío en vivo durante el checkout, antes de confirmar el
/// pedido — ya no hay tarifa única de respaldo (ver createStoreOrder), así
/// que el checkout necesita esto para mostrar el costo real.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Cotizar envío: 60 por minuto por IP. Ver src/lib/rate-limit.ts.
  const limited = await limitOrReject(req, "envio", 60, 60);
  if (limited) return limited;

  const { slug } = await params;
  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
  if (!brand) {
    return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = quoteShippingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const result = await quoteShipping(brand.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: REASON_MESSAGE[result.reason] },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, shippingCents: result.shippingCents, rateName: result.rateName });
}
