import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComplementaryProducts } from "@/server/services/store-order-service";

/// GET ?ids=a,b,c → productos para "Completa tu compra" en el carrito. Ver
/// getComplementaryProducts.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
    select: { id: true },
  });
  if (!brand) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 64)
    .slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ products: [] });

  const products = await getComplementaryProducts(brand.id, ids);
  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl: p.imageUrl,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
      stock: p.stock,
      type: p.type,
      hasVariants: p.hasVariants,
    })),
  });
}
