import { prisma } from "@/lib/prisma";
import { type SectionType } from "@/lib/storefront-sections";
import { createStorefrontSection } from "@/server/services/storefront-section-service";

/// Portada básica: hasta seis colecciones con foto ("Compra por
/// categoría"), las novedades y el catálogo completo. Se agrega lo que
/// falte, debajo de lo que la marca ya tenga (un banner suelto, por
/// ejemplo). La usa la importación cuando la portada de la tienda vieja
/// no se reconoció o no muestra productos, y el botón de Diseño → Página
/// de inicio. Rumi y amglow (WooCommerce) se importaron y quedaron con la
/// página de inicio vacía — ver conversación del 2026-10-18.

export type DefaultHomeResult = { created: SectionType[]; skipped: "COMPLETE" | null };

export const CATALOG_SECTION_CONFIG = { title: "Todos los productos" };

export async function completeHomeSections(brandId: string): Promise<DefaultHomeResult> {
  const existing = await prisma.storefrontSection.findMany({ where: { brandId, enabled: true }, select: { type: true } });
  const has = (...types: SectionType[]) => existing.some((s) => types.includes(s.type as SectionType));
  const created: SectionType[] = [];

  if (!has("CATEGORY_GRID", "CATEGORY_BANNERS")) {
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
    const productImage = (p: { product: { imageUrl: string | null; images: { url: string }[] } }) =>
      p.product.imageUrl ?? p.product.images[0]?.url ?? null;
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
  }

  if (!has("NEW_PRODUCTS")) {
    const activeProducts = await prisma.product.count({ where: { brandId, manual: true, status: "ACTIVE" } });
    if (activeProducts >= 4) {
      await createStorefrontSection(brandId, { type: "NEW_PRODUCTS", config: { title: "Novedades", display: "carousel" } });
      created.push("NEW_PRODUCTS");
    }
  }

  if (!has("PRODUCT_CATALOG")) {
    await createStorefrontSection(brandId, { type: "PRODUCT_CATALOG", config: CATALOG_SECTION_CONFIG });
    created.push("PRODUCT_CATALOG");
  }
  return { created, skipped: created.length > 0 ? null : "COMPLETE" };
}
