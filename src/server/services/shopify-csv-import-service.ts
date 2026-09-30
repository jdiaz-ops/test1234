import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugFromHandle } from "@/lib/shopify-csv";
import type { importShopifyProductsSchema } from "@/lib/validation/brand";
import {
  createManualProduct,
  updateManualProduct,
  BrandStoreProductError,
  type ManualProductInput,
} from "@/server/services/brand-store-product-service";
import {
  createBrandCollection,
  BrandCollectionError,
} from "@/server/services/brand-collection-service";

type ImportProduct = z.infer<typeof importShopifyProductsSchema>["products"][number];

export type ShopifyImportResult = {
  handle: string;
  name: string;
  action: "created" | "updated" | "error";
  error?: string;
};

/// Prefijo del externalId de lo que entra por CSV de Shopify — estable por
/// handle, así volver a subir el archivo actualiza el producto en vez de
/// duplicarlo. No choca con los ids de la sincronización en vivo
/// (numéricos/GIDs) ni con los "manual-" de Crear producto.
const EXTERNAL_ID_PREFIX = "shopify-csv-";

/// Crea o actualiza cada producto del lote como producto manual de "Mi
/// tienda" (editable después como cualquier otro) y lo mete en la
/// colección que corresponde a su Tipo de Shopify, creándola si no existe.
/// Un producto que falla no frena a los demás: cada uno devuelve su
/// resultado y el navegador muestra el resumen.
export async function importShopifyProducts(
  brandId: string,
  products: ImportProduct[],
): Promise<ShopifyImportResult[]> {
  const existingCollections = await prisma.brandCollection.findMany({
    where: { brandId },
    select: { id: true, name: true },
  });
  const collectionIdByName = new Map(
    existingCollections.map((c) => [c.name.trim().toLowerCase(), c.id]),
  );

  async function resolveCollectionId(name: string | null | undefined) {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    const found = collectionIdByName.get(key);
    if (found) return found;
    const created = await createBrandCollection(brandId, { name });
    collectionIdByName.set(key, created.id);
    return created.id;
  }

  const results: ShopifyImportResult[] = [];
  for (const item of products) {
    try {
      const externalId = `${EXTERNAL_ID_PREFIX}${item.handle}`;
      const existing = await prisma.product.findUnique({
        where: { brandId_externalId: { brandId, externalId } },
        include: { brandCollections: { select: { collectionId: true } } },
      });
      const collectionId = await resolveCollectionId(item.collectionName);
      // Al re-importar se conservan las colecciones que la marca le haya
      // puesto a mano — solo se suma la del CSV.
      const collectionIds = new Set(
        existing?.brandCollections.map((c) => c.collectionId) ?? [],
      );
      if (collectionId) collectionIds.add(collectionId);

      const input: ManualProductInput = {
        externalId,
        name: item.name,
        description: item.description || undefined,
        price: item.price,
        compareAtPrice: item.compareAtPrice ?? null,
        images: item.images,
        slug: existing?.slug ?? slugFromHandle(item.handle, item.name),
        sku: item.sku,
        barcode: item.barcode,
        weight: item.weight ?? null,
        weightUnit: item.weightUnit,
        stock: item.stock ?? null,
        // Un producto que ya existe conserva el estado que tiene en
        // Marcolini. Antes tomaba el del CSV en cada subida, y como la
        // exportación refleja el estado en Shopify (Published/Status), al
        // volver a subir el archivo para traer inventario los productos
        // que en Shopify ya estaban despublicados pasaban a borrador acá
        // y "desaparecían de la web". Ver conversación del 2026-09-30.
        status: existing ? existing.status : item.status,
        type: "PHYSICAL",
        collectionIds: Array.from(collectionIds),
        hasVariants: item.hasVariants,
        optionNames: item.optionNames,
        variants: item.variants,
      };

      if (existing) {
        await updateManualProduct(brandId, existing.id, input);
        results.push({ handle: item.handle, name: item.name, action: "updated" });
      } else {
        await createManualProduct(brandId, input);
        results.push({ handle: item.handle, name: item.name, action: "created" });
      }
    } catch (err) {
      console.error(`[shopify-csv] "${item.handle}":`, err);
      results.push({
        handle: item.handle,
        name: item.name,
        action: "error",
        error:
          err instanceof BrandStoreProductError || err instanceof BrandCollectionError
            ? err.message
            : "No se pudo guardar este producto.",
      });
    }
  }
  return results;
}
