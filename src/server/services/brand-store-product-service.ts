import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { setProductCollections } from "@/server/services/brand-collection-service";

export class BrandStoreProductError extends Error {}

type VariantInput = {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  sku?: string;
  barcode?: string;
  stock: number;
};

type ManualProductInput = {
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  images?: string[];
  slug: string;
  sku?: string;
  barcode?: string;
  stock?: number | null;
  available: boolean;
  type?: "PHYSICAL" | "SERVICE";
  serviceModality?: "VIRTUAL" | "PRESENCIAL" | null;
  serviceDurationMinutes?: number | null;
  serviceLocation?: string;
  collectionIds?: string[];
  hasVariants?: boolean;
  optionNames?: string[];
  variants?: VariantInput[];
};

const productListInclude = {
  images: { orderBy: { position: "asc" as const } },
  variants: { orderBy: { position: "asc" as const } },
  brandCollections: { select: { collectionId: true } },
};

/// Productos que la marca creó a mano en "Mi tienda" (manual = true) — nunca
/// se mezclan con los que vienen sincronizados de Shopify/WooCommerce (esos
/// se editan desde product-sync-service.ts, no desde acá). Ver comentario en
/// Product.manual en el schema.
export async function listManualProducts(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: true },
    orderBy: { createdAt: "desc" },
    include: productListInclude,
  });
}

/// El slug ya no lo edita la marca (ver store-product-form.tsx) — si el
/// autogenerado choca con uno existente, le agrega un sufijo en vez de
/// fallar (la marca no tiene forma de resolver el choque a mano).
async function uniqueSlug(
  brandId: string,
  base: string,
  excludeProductId?: string,
) {
  let candidate = base || "producto";
  let n = 2;
  while (true) {
    const existing = await prisma.product.findUnique({
      where: { brandId_slug: { brandId, slug: candidate } },
    });
    if (!existing || existing.id === excludeProductId) return candidate;
    candidate = `${base || "producto"}-${n}`;
    n++;
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

/// Reemplaza toda la galería de un producto por la lista de URLs dada — la
/// primera queda como portada (Product.imageUrl), igual que reemplaza
/// todas las variantes cuando hasVariants = true. Ambas cosas viven en la
/// misma transacción que crea/actualiza el producto (ver abajo).
function replaceImagesOps(productId: string, images: string[]) {
  return [
    prisma.productImage.deleteMany({ where: { productId } }),
    ...(images.length > 0
      ? [
          prisma.productImage.createMany({
            data: images.map((url, position) => ({ productId, url, position })),
          }),
        ]
      : []),
  ];
}

function replaceVariantsOps(productId: string, variants: VariantInput[]) {
  return [
    prisma.productVariant.deleteMany({ where: { productId } }),
    ...(variants.length > 0
      ? [
          prisma.productVariant.createMany({
            data: variants.map((v, position) => ({
              productId,
              option1Value: v.option1Value,
              option2Value: v.option2Value,
              option3Value: v.option3Value,
              price: v.price,
              sku: v.sku || null,
              barcode: v.barcode || null,
              stock: v.stock,
              position,
            })),
          }),
        ]
      : []),
  ];
}

export async function createManualProduct(
  brandId: string,
  data: ManualProductInput,
) {
  const images = data.images ?? [];
  const hasVariants = data.hasVariants ?? false;
  const variants = hasVariants ? (data.variants ?? []) : [];

  const slug = await uniqueSlug(brandId, data.slug);
  const url = await buildStorefrontProductUrl(brandId, slug);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        brandId,
        // Los productos manuales no tienen un id de tienda externa real — se
        // genera uno propio, con un prefijo que nunca puede chocar con un
        // externalId real de Shopify/WooCommerce (esos son numéricos o GIDs).
        externalId: `manual-${crypto.randomUUID()}`,
        manual: true,
        name: data.name,
        description: data.description || null,
        imageUrl: images[0] ?? null,
        price: hasVariants ? 0 : data.price,
        compareAtPrice: hasVariants ? null : (data.compareAtPrice ?? null),
        url,
        slug,
        sku: hasVariants ? null : data.sku || null,
        barcode: hasVariants ? null : data.barcode || null,
        stock: hasVariants ? null : (data.stock ?? null),
        available: data.available,
        type: data.type ?? "PHYSICAL",
        serviceModality: data.type === "SERVICE" ? (data.serviceModality ?? null) : null,
        serviceDurationMinutes: data.type === "SERVICE" ? (data.serviceDurationMinutes ?? null) : null,
        serviceLocation: data.type === "SERVICE" ? data.serviceLocation || null : null,
        hasVariants,
        optionNames: hasVariants ? (data.optionNames ?? []) : [],
      },
    });
    await tx.productImage.createMany({
      data: images.map((imgUrl, position) => ({
        productId: created.id,
        url: imgUrl,
        position,
      })),
    });
    if (variants.length > 0) {
      await tx.productVariant.createMany({
        data: variants.map((v, position) => ({
          productId: created.id,
          option1Value: v.option1Value,
          option2Value: v.option2Value,
          option3Value: v.option3Value,
          price: v.price,
          sku: v.sku || null,
          barcode: v.barcode || null,
          stock: v.stock,
          position,
        })),
      });
    }
    return created;
  });

  await setProductCollections(brandId, product.id, data.collectionIds ?? []);

  return product;
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

  const images = data.images ?? [];
  const hasVariants = data.hasVariants ?? false;
  const variants = hasVariants ? (data.variants ?? []) : [];

  const slug = await uniqueSlug(brandId, data.slug, productId);
  const url = await buildStorefrontProductUrl(brandId, slug);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description || null,
        imageUrl: images[0] ?? null,
        price: hasVariants ? 0 : data.price,
        compareAtPrice: hasVariants ? null : (data.compareAtPrice ?? null),
        slug,
        url,
        sku: hasVariants ? null : data.sku || null,
        barcode: hasVariants ? null : data.barcode || null,
        stock: hasVariants ? null : (data.stock ?? null),
        available: data.available,
        type: data.type ?? "PHYSICAL",
        serviceModality: data.type === "SERVICE" ? (data.serviceModality ?? null) : null,
        serviceDurationMinutes: data.type === "SERVICE" ? (data.serviceDurationMinutes ?? null) : null,
        serviceLocation: data.type === "SERVICE" ? data.serviceLocation || null : null,
        hasVariants,
        optionNames: hasVariants ? (data.optionNames ?? []) : [],
      },
    });
    for (const op of replaceImagesOps(productId, images)) await op;
    for (const op of replaceVariantsOps(productId, variants)) await op;
    return result;
  });

  await setProductCollections(brandId, productId, data.collectionIds ?? []);

  return updated;
}

export async function deleteManualProduct(brandId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: true },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");

  await prisma.product.delete({ where: { id: productId } });
}
