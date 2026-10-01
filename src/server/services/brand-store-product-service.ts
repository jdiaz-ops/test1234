import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { nextCollectionPositions, setProductCollections } from "@/server/services/brand-collection-service";
import { sanitizeProductDescription } from "@/lib/sanitize-html";

export class BrandStoreProductError extends Error {}

type VariantInput = {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  sku?: string;
  barcode?: string;
  stock: number;
  weight?: number | null;
  weightUnit?: "KG" | "G";
};

export type ManualProductInput = {
  /// Solo lo manda la importación por CSV de Shopify (estable por handle,
  /// ver shopify-csv-import-service.ts) — Crear producto lo deja vacío y
  /// se genera uno propio abajo.
  externalId?: string;
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number | null;
  images?: string[];
  slug: string;
  sku?: string;
  barcode?: string;
  weight?: number | null;
  weightUnit?: "KG" | "G";
  stock?: number | null;
  /// Reemplaza el viejo "available: boolean" — el campo `available` de
  /// Prisma se sigue derivando de esto al guardar (status !== DRAFT),
  /// para no tener que tocar cada lugar que ya filtra por available.
  status?: "ACTIVE" | "DRAFT" | "UNLISTED";
  type?: "PHYSICAL" | "SERVICE" | "DIGITAL";
  serviceModality?: "VIRTUAL" | "PRESENCIAL" | null;
  serviceDurationMinutes?: number | null;
  serviceLocation?: string;
  digitalFileUrl?: string;
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

/// Aplana una fila de listManualProducts al shape plano que espera el
/// portal (ManualProduct en store-product-form.tsx) — Decimal → number,
/// images/brandCollections (relaciones, objetos) → arrays planos de
/// string. SIN esto, cualquier lugar que lea el producto tal como viene
/// de Prisma (ej. la API GET de abajo) manda esos objetos derecho al
/// formulario, y al guardar el schema de creación (que espera
/// `images: string[]`) revienta con "Invalid input: expected string,
/// received object" — pasó exactamente eso al duplicar un producto cuya
/// lista se había recargado por API en vez de venir del render inicial
/// del server. Un solo mapeo compartido para que page.tsx (SSR) y la
/// API GET nunca vuelvan a desincronizarse. Ver conversación del
/// 2026-09-14.
export function toManualProductSummary(
  product: Awaited<ReturnType<typeof listManualProducts>>[number],
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    images: product.images.map((img) => img.url),
    imageUrl: product.imageUrl,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
    slug: product.slug,
    sku: product.sku,
    barcode: product.barcode,
    weight: product.weight != null ? Number(product.weight) : null,
    weightUnit: product.weightUnit,
    stock: product.stock,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    type: product.type,
    serviceModality: product.serviceModality,
    serviceDurationMinutes: product.serviceDurationMinutes,
    serviceLocation: product.serviceLocation,
    digitalFileUrl: product.digitalFileUrl,
    collectionIds: product.brandCollections.map((c) => c.collectionId),
    hasVariants: product.hasVariants,
    optionNames: product.optionNames,
    variants: product.variants.map((v) => ({
      id: v.id,
      option1Value: v.option1Value,
      option2Value: v.option2Value,
      option3Value: v.option3Value,
      price: v.price != null ? Number(v.price) : null,
      sku: v.sku,
      barcode: v.barcode,
      stock: v.stock,
      weight: v.weight != null ? Number(v.weight) : null,
      weightUnit: v.weightUnit,
    })),
  };
}

/// Productos sincronizados de Shopify/WooCommerce (manual = false) para
/// elegir en "Importar producto" — ya tenemos su nombre, descripción,
/// peso, SKU y fotos, así que la marca no tiene que volver a escribirlo
/// a mano en un producto manual editable. Ver conversación del
/// 2026-09-14: "me gusta la función de poder importar productos".
export async function listSyncedProductsForImport(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, imageUrl: true, price: true },
  });
}

/// El detalle completo de un producto sincronizado puntual, en el shape
/// que espera StoreProductForm como `seed` — no crea nada, solo prepara
/// los valores para que la marca los revise/edite antes de guardar.
export async function getSyncedProductForImport(brandId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: false },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");
  return {
    name: product.name,
    description: product.description,
    images: product.imageUrl ? [product.imageUrl] : [],
    imageUrl: product.imageUrl,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
    sku: product.sku,
    barcode: product.barcode,
    weight: product.weight != null ? Number(product.weight) : null,
    weightUnit: product.weightUnit,
  };
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
/// misma transacción que actualiza el producto (ver abajo), y por eso
/// reciben `db` = el cliente de ESA transacción. Antes usaban el cliente
/// global: las fotos se insertaban por otra conexión mientras la
/// transacción tenía bloqueada la fila del producto (Postgres toma el
/// bloqueo fuerte cuando cambia el slug, que es índice único — el caso de
/// todo producto importado de Shopify, cuyo slug vino del handle y no del
/// nombre), la inserción se quedaba esperando a la transacción y la
/// transacción a la inserción → expiraba a los 5 s y el editor mostraba
/// "No se pudo guardar el producto" sin más. Ver conversación del
/// 2026-09-30.
async function replaceImages(db: Prisma.TransactionClient, productId: string, images: string[]) {
  await db.productImage.deleteMany({ where: { productId } });
  if (images.length > 0) {
    await db.productImage.createMany({
      data: images.map((url, position) => ({ productId, url, position })),
    });
  }
}

async function replaceVariants(db: Prisma.TransactionClient, productId: string, variants: VariantInput[]) {
  await db.productVariant.deleteMany({ where: { productId } });
  if (variants.length > 0) {
    await db.productVariant.createMany({
      data: variants.map((v, position) => ({
        productId,
        option1Value: v.option1Value,
        option2Value: v.option2Value,
        option3Value: v.option3Value,
        price: v.price,
        sku: v.sku || null,
        barcode: v.barcode || null,
        stock: v.stock,
        weight: v.weight ?? null,
        weightUnit: v.weightUnit ?? "KG",
        position,
      })),
    });
  }
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
        externalId: data.externalId ?? `manual-${crypto.randomUUID()}`,
        manual: true,
        name: data.name,
        description: data.description
          ? sanitizeProductDescription(data.description)
          : null,
        imageUrl: images[0] ?? null,
        price: hasVariants ? 0 : data.price,
        compareAtPrice: hasVariants ? null : (data.compareAtPrice ?? null),
        url,
        slug,
        sku: hasVariants ? null : data.sku || null,
        barcode: hasVariants ? null : data.barcode || null,
        weight: hasVariants || data.type === "DIGITAL" ? null : (data.weight ?? null),
        weightUnit: data.weightUnit ?? "KG",
        stock: hasVariants ? null : (data.stock ?? null),
        status: data.status ?? "ACTIVE",
        available: (data.status ?? "ACTIVE") !== "DRAFT",
        type: data.type ?? "PHYSICAL",
        serviceModality: data.type === "SERVICE" ? (data.serviceModality ?? null) : null,
        serviceDurationMinutes: data.type === "SERVICE" ? (data.serviceDurationMinutes ?? null) : null,
        serviceLocation: data.type === "SERVICE" ? data.serviceLocation || null : null,
        digitalFileUrl: data.type === "DIGITAL" ? data.digitalFileUrl || null : null,
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
          weight: v.weight ?? null,
          weightUnit: v.weightUnit ?? "KG",
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
        description: data.description
          ? sanitizeProductDescription(data.description)
          : null,
        imageUrl: images[0] ?? null,
        price: hasVariants ? 0 : data.price,
        compareAtPrice: hasVariants ? null : (data.compareAtPrice ?? null),
        slug,
        url,
        sku: hasVariants ? null : data.sku || null,
        barcode: hasVariants ? null : data.barcode || null,
        weight: hasVariants || data.type === "DIGITAL" ? null : (data.weight ?? null),
        weightUnit: data.weightUnit ?? "KG",
        stock: hasVariants ? null : (data.stock ?? null),
        status: data.status ?? "ACTIVE",
        available: (data.status ?? "ACTIVE") !== "DRAFT",
        type: data.type ?? "PHYSICAL",
        serviceModality: data.type === "SERVICE" ? (data.serviceModality ?? null) : null,
        serviceDurationMinutes: data.type === "SERVICE" ? (data.serviceDurationMinutes ?? null) : null,
        serviceLocation: data.type === "SERVICE" ? data.serviceLocation || null : null,
        digitalFileUrl: data.type === "DIGITAL" ? data.digitalFileUrl || null : null,
        hasVariants,
        optionNames: hasVariants ? (data.optionNames ?? []) : [],
      },
    });
    await replaceImages(tx, productId, images);
    await replaceVariants(tx, productId, variants);
    return result;
  });

  await setProductCollections(brandId, productId, data.collectionIds ?? []);

  return updated;
}

/// Inventario y/o estado desde la fila de la tabla de Productos, sin pasar
/// por el formulario completo. El inventario solo aplica a productos sin
/// variantes (con variantes vive en cada variante → Editar). Ver
/// conversación del 2026-09-30.
export async function quickUpdateManualProduct(
  brandId: string,
  productId: string,
  data: {
    stock?: number;
    status?: "ACTIVE" | "DRAFT" | "UNLISTED";
    price?: number;
    compareAtPrice?: number | null;
  },
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: true },
    select: { id: true, hasVariants: true, price: true, compareAtPrice: true },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");
  if ((data.stock != null || data.price != null || data.compareAtPrice !== undefined) && product.hasVariants) {
    throw new BrandStoreProductError(
      "Este producto tiene variantes: inventario y precios se ajustan por variante desde Editar.",
    );
  }
  if (data.status === "ACTIVE" && !product.hasVariants && Number(product.price) <= 0 && !data.price) {
    throw new BrandStoreProductError("Ponle un precio antes de activarlo.");
  }
  // El "precio antes" tiene que ser mayor al precio para que sea una
  // oferta de verdad — si no, se guarda igual pero la tienda no muestra
  // descuento (ver discountPercent en product-card.tsx).
  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.stock != null ? { stock: data.stock } : {}),
      ...(data.status ? { status: data.status, available: data.status !== "DRAFT" } : {}),
      ...(data.price != null ? { price: data.price } : {}),
      ...(data.compareAtPrice !== undefined ? { compareAtPrice: data.compareAtPrice } : {}),
    },
    select: { id: true, stock: true, status: true, price: true, compareAtPrice: true },
  });
}

/// Edición en grupo desde la tabla de Productos: activar, ocultar, o
/// agregar/quitar de una colección varios productos a la vez. Solo toca
/// productos de esta marca. Activar se salta los que no tienen precio
/// (no se pueden vender). Devuelve cuántos cambió y cuántos se saltó. Ver
/// conversación del 2026-09-30.
export async function bulkProductAction(
  brandId: string,
  data: {
    productIds: string[];
    action: "activate" | "hide" | "addCollection" | "removeCollection";
    collectionId?: string;
  },
) {
  const owned = await prisma.product.findMany({
    where: { id: { in: data.productIds }, brandId, manual: true },
    select: { id: true, price: true, hasVariants: true },
  });
  const ids = owned.map((p) => p.id);
  if (ids.length === 0) throw new BrandStoreProductError("No se encontraron esos productos.");

  if (data.action === "activate") {
    const sellable = owned.filter((p) => p.hasVariants || Number(p.price) > 0).map((p) => p.id);
    const result = await prisma.product.updateMany({
      where: { id: { in: sellable } },
      data: { status: "ACTIVE", available: true },
    });
    return { changed: result.count, skipped: ids.length - sellable.length };
  }
  if (data.action === "hide") {
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: "DRAFT", available: false },
    });
    return { changed: result.count, skipped: 0 };
  }

  if (!data.collectionId) throw new BrandStoreProductError("Elige una colección.");
  const collection = await prisma.brandCollection.findFirst({
    where: { id: data.collectionId, brandId },
    select: { id: true },
  });
  if (!collection) throw new BrandStoreProductError("Colección no encontrada.");

  if (data.action === "addCollection") {
    // Los que entran van al final del orden manual de la colección, en el
    // orden en que vienen; los que ya estaban no se mueven.
    const already = await prisma.productBrandCollection.findMany({
      where: { collectionId: collection.id, productId: { in: ids } },
      select: { productId: true },
    });
    const alreadyIds = new Set(already.map((r) => r.productId));
    const toAdd = ids.filter((id) => !alreadyIds.has(id));
    const start = (await nextCollectionPositions([collection.id])).get(collection.id) ?? 0;
    const result = await prisma.productBrandCollection.createMany({
      data: toAdd.map((productId, i) => ({ productId, collectionId: collection.id, position: start + i })),
      skipDuplicates: true,
    });
    return { changed: result.count, skipped: ids.length - result.count };
  }
  const result = await prisma.productBrandCollection.deleteMany({
    where: { collectionId: collection.id, productId: { in: ids } },
  });
  return { changed: result.count, skipped: ids.length - result.count };
}

/// Pone en Activo todos los borradores de la marca que se pueden vender
/// (tienen precio o variantes) — el botón "Activar todos los borradores"
/// de la lista de productos. Nació para recuperar los productos que una
/// reimportación del CSV de Shopify había mandado a borrador de golpe
/// (ver shopify-csv-import-service.ts); sirve igual para publicar un lote
/// de una vez. Devuelve cuántos cambió.
export async function activateDraftProducts(brandId: string) {
  const result = await prisma.product.updateMany({
    where: {
      brandId,
      manual: true,
      status: "DRAFT",
      OR: [{ price: { gt: 0 } }, { hasVariants: true }],
    },
    data: { status: "ACTIVE", available: true },
  });
  return result.count;
}

export async function deleteManualProduct(brandId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: true },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");

  await prisma.product.delete({ where: { id: productId } });
}
