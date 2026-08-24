import { prisma } from "@/lib/prisma";

export class ProductError extends Error {}

const MAX_FEATURED_PER_BRAND = 3;

export async function listProductsForBrand(brandId: string) {
  return prisma.product.findMany({
    where: { brandId },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
}

/// Hasta 3 productos destacados por marca — aparecen primero como
/// "sugeridos" cuando un creador arma una colección con productos de esta
/// marca (ver listSuggestedProductsForCreator).
export async function setProductFeatured(brandId: string, productId: string, featured: boolean) {
  const product = await prisma.product.findFirst({ where: { id: productId, brandId } });
  if (!product) throw new ProductError("Producto no encontrado.");

  if (featured && !product.featured) {
    const count = await prisma.product.count({ where: { brandId, featured: true } });
    if (count >= MAX_FEATURED_PER_BRAND) {
      throw new ProductError(`Ya tienes ${MAX_FEATURED_PER_BRAND} productos destacados — quita uno antes de agregar otro.`);
    }
  }

  return prisma.product.update({ where: { id: productId }, data: { featured } });
}

/// Productos disponibles de las marcas a las que el creador está ACTIVE —
/// es el universo del que puede elegir al armar una colección. `search`
/// filtra por nombre o marca (insensible a mayúsculas).
export async function listProductsForCreator(creatorId: string, search?: string) {
  const brandIds = await activeBrandIdsForCreator(creatorId);
  if (brandIds.length === 0) return [];

  return prisma.product.findMany({
    where: {
      brandId: { in: brandIds },
      available: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { brand: { companyName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { brand: { select: { companyName: true, storeType: true } } },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    take: 60,
  });
}

/// Los productos destacados por las marcas del creador — se muestran como
/// franja "Sugeridos" arriba del buscador al armar una colección.
export async function listSuggestedProductsForCreator(creatorId: string) {
  const brandIds = await activeBrandIdsForCreator(creatorId);
  if (brandIds.length === 0) return [];

  return prisma.product.findMany({
    where: { brandId: { in: brandIds }, available: true, featured: true },
    include: { brand: { select: { companyName: true, storeType: true } } },
    orderBy: { name: "asc" },
  });
}

async function activeBrandIdsForCreator(creatorId: string) {
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { creatorId, status: "ACTIVE" },
    select: { offer: { select: { brandId: true } } },
  });
  return [...new Set(enrollments.map((e) => e.offer.brandId))];
}
