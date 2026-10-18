import { prisma } from "@/lib/prisma";
import type { SectionType } from "@/lib/storefront-sections";
import { createStorefrontSection } from "@/server/services/storefront-section-service";

/// Portada básica para una marca que no tiene ninguna sección: hasta seis
/// colecciones con foto ("Compra por categoría"), las novedades y el
/// catálogo completo. La arma la importación cuando no reconoce la portada
/// de la tienda vieja y el botón "Armar portada básica" de Diseño → Página
/// de inicio. Rumi y amglow (WooCommerce) se importaron y quedaron con la
/// página de inicio vacía — ver conversación del 2026-10-18.

export type DefaultHomeResult = { created: SectionType[]; skipped: "HAS_SECTIONS" | null };

/// Tipos de sección que muestran productos: una portada sin ninguno de
/// estos no vende nada.
export const PRODUCT_SECTION_TYPES: ReadonlySet<SectionType> = new Set<SectionType>([
  "FEATURED_COLLECTION",
  "CATEGORY_GRID",
  "FEATURED_PRODUCTS",
  "NEW_PRODUCTS",
  "ON_SALE_PRODUCTS",
  "PRODUCT_CATALOG",
]);

export const CATALOG_SECTION_CONFIG = { title: "Todos los productos" };

export async function buildDefaultHomeSections(brandId: string): Promise<DefaultHomeResult> {
  const existing = await prisma.storefrontSection.count({ where: { brandId } });
  if (existing > 0) return { created: [], skipped: "HAS_SECTIONS" };

  const created: SectionType[] = [];
  const collections = await prisma.brandCollection.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      imageUrl: true,
      products: {
        where: { product: { manual: true, status: "ACTIVE" } },
        orderBy: { position: "asc" },
        select: { product: { select: { imageUrl: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } } },
      },
    },
  });
  // Las colecciones con más productos primero; la foto es la de la
  // colección o, si no tiene, la del primer producto con foto.
  const productImage = (p: { product: { imageUrl: string | null; images: { url: string }[] } }) => p.product.imageUrl ?? p.product.images[0]?.url ?? null;
  const ranked = collections
    .map((c, position) => ({
      id: c.id,
      position,
      count: c.products.length,
      imageUrl: c.imageUrl ?? c.products.map(productImage).find((url) => url) ?? null,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.position - b.position)
    .slice(0, 6);
  if (ranked.length >= 2) {
    await createStorefrontSection(brandId, {
      type: "CATEGORY_GRID",
      config: {
        title: "Compra por categoría",
        subtitle: "",
        items: Array.from({ length: 6 }, (_, i) =>
          ranked[i]
            ? { show: true, collectionId: ranked[i].id, imageUrl: ranked[i].imageUrl, label: "" }
            : { show: false, collectionId: null, imageUrl: null, label: "" },
        ),
      },
    });
    created.push("CATEGORY_GRID");
  }

  const activeProducts = await prisma.product.count({ where: { brandId, manual: true, status: "ACTIVE" } });
  if (activeProducts >= 4) {
    await createStorefrontSection(brandId, { type: "NEW_PRODUCTS", config: { title: "Novedades", display: "carousel" } });
    created.push("NEW_PRODUCTS");
  }
  await createStorefrontSection(brandId, { type: "PRODUCT_CATALOG", config: CATALOG_SECTION_CONFIG });
  created.push("PRODUCT_CATALOG");
  return { created, skipped: null };
}

/// Si ninguna sección prendida muestra productos, agrega el catálogo al
/// final. Devuelve si lo agregó.
export async function ensureProductsSection(brandId: string): Promise<boolean> {
  const sections = await prisma.storefrontSection.findMany({ where: { brandId, enabled: true }, select: { type: true } });
  if (sections.some((s) => PRODUCT_SECTION_TYPES.has(s.type as SectionType))) return false;
  await createStorefrontSection(brandId, { type: "PRODUCT_CATALOG", config: CATALOG_SECTION_CONFIG });
  return true;
}
