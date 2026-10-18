import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/shopify-csv";
import { BrandStoreProductError, createManualProduct } from "@/server/services/brand-store-product-service";

/// "Separar variantes en productos": cada variante de un producto pasa a
/// ser un producto propio — nombre + variante, su precio, su foto, su
/// inventario, SKU y las mismas colecciones — y el original queda oculto
/// (borrador) por si hay que volver. Nació para Beauty Solution: una
/// "placa" de 12 tonos como un solo producto no se puede agregar al
/// carrito con sentido ni se ve bien en la vitrina de las creadoras. Cada
/// producto nuevo guarda sus atributos (el eje de la variante y el grupo
/// del que salió) para los filtros de la colección. Ver conversación del
/// 2026-10-18.

export type SplitResult = { original: { id: string; name: string }; created: { id: string; name: string }[] };

/// Nombres de eje que Shopify pone cuando no hay uno real.
function axisLabel(name: string) {
  const key = name.trim().toLowerCase();
  return !key || key === "title" || key === "título" || key === "titulo" || key === "default title" ? "Opción" : name.trim();
}

/// Lo que comparten todos los nombres al principio, palabra por palabra
/// ("Gel Polish Rosados", "Gel Polish Verdes" → "Gel Polish ").
export function commonNamePrefix(names: string[]): string {
  if (names.length < 2) return "";
  const words = names.map((n) => n.trim().split(/\s+/));
  const prefix: string[] = [];
  for (let i = 0; ; i++) {
    const word = words[0][i];
    if (word === undefined) break;
    if (!words.every((w) => w[i] !== undefined && w[i].toLowerCase() === word.toLowerCase())) break;
    prefix.push(word);
  }
  // Si el prefijo es el nombre completo de alguno, no sirve como grupo.
  if (words.some((w) => w.length <= prefix.length)) return "";
  return prefix.length > 0 ? prefix.join(" ") + " " : "";
}

/// El grupo de un producto para los filtros: su nombre sin lo que
/// comparte con los demás que se separan a la vez ("Rosados"), o el
/// nombre entero si no comparten nada.
export function groupLabel(name: string, prefix: string) {
  const clean = name.trim();
  if (prefix && clean.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = clean.slice(prefix.length).trim();
    if (rest) return rest;
  }
  return clean;
}

export async function splitProductVariants(brandId: string, productId: string, group?: string): Promise<SplitResult> {
  const product = await prisma.product.findFirst({
    where: { id: productId, brandId, manual: true },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" } },
      brandCollections: { select: { collectionId: true } },
    },
  });
  if (!product) throw new BrandStoreProductError("Producto no encontrado.");
  if (!product.hasVariants || product.variants.length === 0) {
    throw new BrandStoreProductError(`"${product.name}" no tiene variantes que separar.`);
  }

  const productImages = product.images.map((i) => i.url);
  // Las fotos de la galería que son la foto de alguna variante pertenecen a
  // ese tono; las demás (la placa con todos los tonos, el empaque) son
  // generales y van en todos. Antes cada tono se llevaba la galería entera
  // y en su página aparecían los demás tonos (2026-10-18).
  const variantImages = new Set(product.variants.map((v) => v.imageUrl).filter((u): u is string => Boolean(u)));
  const genericImages = productImages.filter((u) => !variantImages.has(u));
  const collectionIds = product.brandCollections.map((c) => c.collectionId);
  const created: SplitResult["created"] = [];

  for (const variant of product.variants) {
    const values = [variant.option1Value, variant.option2Value, variant.option3Value];
    const label = product.optionNames
      .map((_, idx) => values[idx])
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(" / ");
    const name = label ? `${product.name} – ${label}` : product.name;
    const attributes: Record<string, string> = { Grupo: group?.trim() || product.name };
    product.optionNames.forEach((axis, idx) => {
      const value = values[idx];
      if (value && value.trim()) attributes[axisLabel(axis)] = value.trim();
    });
    const images = variant.imageUrl
      ? [variant.imageUrl, ...genericImages.filter((u) => u !== variant.imageUrl)]
      : genericImages.length > 0
        ? genericImages
        : productImages.slice(0, 1);
    const item = await createManualProduct(brandId, {
      name,
      description: product.description ?? undefined,
      price: variant.price != null ? Number(variant.price) : Number(product.price),
      compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
      images,
      slug: slugify(name),
      sku: variant.sku ?? product.sku ?? undefined,
      barcode: variant.barcode ?? product.barcode ?? undefined,
      weight: variant.weight != null ? Number(variant.weight) : product.weight != null ? Number(product.weight) : null,
      weightUnit: variant.weight != null ? variant.weightUnit : product.weightUnit,
      stock: variant.stock,
      status: product.status === "DRAFT" ? "DRAFT" : product.status === "UNLISTED" ? "UNLISTED" : "ACTIVE",
      type: product.type,
      serviceModality: product.serviceModality,
      serviceDurationMinutes: product.serviceDurationMinutes,
      serviceLocation: product.serviceLocation ?? undefined,
      digitalFileUrl: product.digitalFileUrl ?? undefined,
      collectionIds,
      hasVariants: false,
      attributes,
    });
    created.push({ id: item.id, name: item.name });
  }

  // El original se oculta: los pedidos viejos lo siguen referenciando y
  // la marca puede volver a activarlo si se arrepiente.
  await prisma.product.update({
    where: { id: product.id },
    data: { status: "DRAFT", available: false },
  });

  return { original: { id: product.id, name: product.name }, created };
}

/// Varios a la vez (desde la tabla de Productos): el grupo de cada uno es
/// su nombre sin lo que comparten todos ("Gel Polish Rosados" entre "Gel
/// Polish Verdes" y "Gel Polish Salmón" → "Rosados"). Los que no tienen
/// variantes se saltan.
export async function splitProductsVariants(brandId: string, productIds: string[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, brandId, manual: true },
    select: { id: true, name: true, hasVariants: true, _count: { select: { variants: true } } },
  });
  const splittable = products.filter((p) => p.hasVariants && p._count.variants > 0);
  const prefix = commonNamePrefix(splittable.map((p) => p.name));
  let createdCount = 0;
  for (const p of splittable) {
    const result = await splitProductVariants(brandId, p.id, groupLabel(p.name, prefix));
    createdCount += result.created.length;
  }
  return { changed: createdCount, skipped: products.length - splittable.length, splitProducts: splittable.length };
}
