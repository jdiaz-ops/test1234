import { prisma } from "@/lib/prisma";
import { sendNewReviewBrandEmail } from "@/lib/email";
import { portalUrl } from "@/lib/store-url";

/// Reseñas de productos de "Mi tienda". Solo puede opinar quien compró: el
/// correo tiene que coincidir con un pedido pagado de esa marca que
/// incluya el producto. Nada se publica hasta que la marca lo aprueba.
/// Ver conversación del 2026-09-30.

export class ProductReviewError extends Error {}

export async function submitProductReview(
  storefrontSlug: string,
  input: { productId: string; name: string; email: string; rating: number; body: string },
) {
  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug },
    select: { id: true, user: { select: { email: true } } },
  });
  if (!brand) throw new ProductReviewError("Tienda no encontrada.");

  const product = await prisma.product.findFirst({
    where: { id: input.productId, brandId: brand.id, manual: true, status: { not: "DRAFT" } },
    select: { id: true, name: true },
  });
  if (!product) throw new ProductReviewError("Producto no encontrado.");

  const email = input.email.trim().toLowerCase();
  const order = await prisma.storeOrder.findFirst({
    where: {
      brandId: brand.id,
      buyerEmail: email,
      status: "PAID",
      items: { some: { productId: product.id } },
    },
    select: { id: true },
    orderBy: { paidAt: "desc" },
  });
  if (!order) {
    throw new ProductReviewError(
      "Solo pueden opinar quienes compraron este producto. Usa el mismo correo con el que hiciste tu pedido.",
    );
  }

  const existing = await prisma.productReview.findUnique({
    where: { productId_authorEmail: { productId: product.id, authorEmail: email } },
    select: { id: true },
  });
  if (existing) throw new ProductReviewError("Ya dejaste una reseña para este producto. ¡Gracias!");

  const review = await prisma.productReview.create({
    data: {
      brandId: brand.id,
      productId: product.id,
      orderId: order.id,
      authorName: input.name.trim(),
      authorEmail: email,
      rating: input.rating,
      body: input.body.trim(),
    },
  });

  try {
    if (brand.user?.email) {
      await sendNewReviewBrandEmail(brand.user.email, {
        productName: product.name,
        authorName: review.authorName,
        rating: review.rating,
        body: review.body,
        reviewsUrl: `${portalUrl()}/marca/tienda/resenas`,
      });
    }
  } catch (err) {
    console.error(`[resenas] No se pudo avisar a la marca de la reseña ${review.id}:`, err);
  }
  return review;
}

/// Reseñas publicadas de un producto + promedio, para la ficha.
export async function getProductReviews(productId: string) {
  const [reviews, stats] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, authorName: true, rating: true, body: true, createdAt: true },
    }),
    prisma.productReview.aggregate({
      where: { productId, status: "APPROVED" },
      _avg: { rating: true },
      _count: true,
    }),
  ]);
  return { reviews, average: stats._avg.rating ?? 0, count: stats._count };
}

export async function listBrandReviews(brandId: string) {
  return prisma.productReview.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, slug: true, imageUrl: true } } },
  });
}

export async function moderateReview(
  brandId: string,
  data: { reviewId: string; action: "approve" | "hide" | "delete" },
) {
  const review = await prisma.productReview.findFirst({
    where: { id: data.reviewId, brandId },
    select: { id: true },
  });
  if (!review) throw new ProductReviewError("Reseña no encontrada.");
  if (data.action === "delete") {
    await prisma.productReview.delete({ where: { id: review.id } });
    return null;
  }
  return prisma.productReview.update({
    where: { id: review.id },
    data: { status: data.action === "approve" ? "APPROVED" : "HIDDEN" },
  });
}
