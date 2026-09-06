import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateDiscountCodeSchema } from "@/lib/validation/storefront";
import {
  previewDiscountCode,
  StoreOrderError,
} from "@/server/services/store-order-service";

/// Valida en vivo el código de un creador durante el checkout, sin crear
/// nada — así el comprador ve el descuento aplicado antes de confirmar.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
  if (!brand) {
    return NextResponse.json(
      { error: "Tienda no encontrada" },
      { status: 404 },
    );
  }

  const body = await req.json();
  const parsed = validateDiscountCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const result = await previewDiscountCode(brand.id, parsed.data.code);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof StoreOrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
