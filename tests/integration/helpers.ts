import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

/// Marca de prueba con su usuario, aislada por un sufijo al azar.
export async function createBrand() {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: { email: `marca-${suffix}@prueba.test`, role: "BRAND" },
  });
  return prisma.brandProfile.create({
    data: { userId: user.id, companyName: `Marca ${suffix}`, storefrontSlug: `prueba-${suffix}` },
  });
}

export async function createProduct(
  brandId: string,
  data: { name: string; price: number; stock: number | null; variants?: { label: string; stock: number }[] },
) {
  const suffix = randomUUID().slice(0, 8);
  return prisma.product.create({
    data: {
      brandId,
      externalId: `manual-${suffix}`,
      manual: true,
      name: data.name,
      price: data.price,
      url: `/t/x/${suffix}`,
      slug: `p-${suffix}`,
      stock: data.variants ? null : data.stock,
      status: "ACTIVE",
      available: true,
      hasVariants: Boolean(data.variants),
      optionNames: data.variants ? ["Color"] : [],
      variants: data.variants
        ? { create: data.variants.map((v, position) => ({ option1Value: v.label, stock: v.stock, price: null, position })) }
        : undefined,
    },
    include: { variants: true },
  });
}

/// Pedido pendiente de pago, como lo deja el checkout antes de Wompi.
export async function createPendingOrder(
  brandId: string,
  lines: { productId: string; variantId?: string | null; quantity: number; unitPrice: number }[],
  buyerEmail = `comprador-${randomUUID().slice(0, 8)}@prueba.test`,
) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPrice * 100 * l.quantity, 0);
  return prisma.storeOrder.create({
    data: {
      brandId,
      reference: `mt_${randomUUID()}`,
      buyerName: "Compradora de Prueba",
      buyerEmail,
      buyerPhone: "3000000000",
      shippingAddress: "Calle 1 # 2-3",
      shippingCity: "Medellín",
      shippingRegion: "Antioquia",
      subtotalCents,
      totalCents: subtotalCents,
      paymentMode: "TEST",
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId ?? null,
          name: "Producto",
          unitPriceCents: l.unitPrice * 100,
          quantity: l.quantity,
        })),
      },
    },
  });
}
