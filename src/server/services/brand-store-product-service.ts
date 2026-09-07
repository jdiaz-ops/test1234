import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export class BrandStoreProductError extends Error {}

type ManualProductInput = {
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string;
  slug: string;
  stock?: number | null;
  available: boolean;
  type?: "PHYSICAL" | "SERVICE";
  serviceModality?: "VIRTUAL" | "PRESENCIAL" | null;
  serviceDurationMinutes?: number | null;
  serviceLocation?: string;
};

/// Productos que la marca creó a mano en "Mi tienda" (manual = true) — nunca
/// se mezclan con los que vienen sincronizados de Shopify/WooCommerce (esos
/// se editan desde product-sync-service.ts, no desde acá). Ver comentario en
/// Product.manual en el schema.
export async function listManualProducts(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: true },
    orderBy: { createdAt: "desc" },
  });
}

async function assertSlugAvailable(
  brandId: string,
  slug: string,
  excludeProductId?: string,
) {
  const existing = await prisma.product.findUnique({
    where: { brandId_slug: { brandId, slug } },
  });
  if (existing && existing.id !== excludeProductId) {
    throw new BrandStoreProductError(
      "Ya tienes un producto con ese slug — elige otro.",
    );
  }
}

/// La URL del producto dentro de "Mi tienda" — mientras la marca no haya
/// configurado su storefrontSlug (Mi tienda → Configuración), usa un
/// marcador temporal; en cuanto lo configure, la ruta ya queda con su slug
/// real sin tener que volver a guardar cada producto (buildProductLink /
/// el server component de la vitrina la arma en el momento, esto es solo
/// lo que se guarda de respaldo en Product.url para consistencia con los
/// productos sincronizados, que sí necesitan una url fija).
async function buildStorefrontProductUrl(brandId: string, productSlug: string) {
  const brand = await prisma.brandProfile.findUnique({
    where: { id: brandId },
    select: { storefrontSlug: true },
  });
  return `/t/${brand?.storefrontSlug ?? "mi-tienda"}/${productSlug}`;
}

export async function createManualProduct(
  brandId: string,
  data: ManualProductInput,
) {
  await assertSlugAvailable(brandId, data.slug);
  const url = await buildStorefrontProductUrl(brandId, data.slug);

  return prisma.product.create({
    data: {
      brandId,
      // Los productos manuales no tienen un id de tienda externa real — se
      // genera uno propio, con un prefijo que nunca puede chocar con un
      // externalId real de Shopify/WooCommerce (esos son numéricos o GIDs).
      externalId: `manual-${crypto.randomUUID()}`,
      manual: true,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      url,
      slug: data.slug,
      stock: data.stock ?? null,
      available: data.available,
      type: data.type ?? "PHYSICAL",
      serviceModality: data.type === "SERVICE" ? (data.serviceModality ?? null) : null,
      serviceDurationMinutes: data.type === "SERVICE" ? (data.serviceDurationMinutes ?? null) : null,
      serviceLocation: data.type === "SERVICE" ? data.serviceLocation || null : null,
    },
  });
}

export async function updateManualProduct(
  brandId: string,
  productId: string,
  data: ManualProductInput,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: true },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");

  await assertSlugAvailable(brandId, data.slug, productId);
  const url = await buildStorefrontProductUrl(brandId, data.slug);

  return prisma.product.update({
    where: { id: productId },
    data: {
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      slug: data.slug,
      url,
      stock: data.stock ?? null,
      available: data.available,
      type: data.type ?? "PHYSICAL",
      serviceModality: data.type === "SERVICE" ? (data.serviceModality ?? null) : null,
      serviceDurationMinutes: data.type === "SERVICE" ? (data.serviceDurationMinutes ?? null) : null,
      serviceLocation: data.type === "SERVICE" ? data.serviceLocation || null : null,
    },
  });
}

export async function deleteManualProduct(brandId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: true },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");

  await prisma.product.delete({ where: { id: productId } });
}
