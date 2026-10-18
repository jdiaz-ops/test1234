import { prisma } from "@/lib/prisma";
import type { SectionType } from "@/lib/storefront-sections";
import { mapShopifyMenuHref, type ShopifyHomeSection } from "@/lib/shopify-theme";
import { createStorefrontSection, StorefrontSectionError } from "@/server/services/storefront-section-service";
import { EXTERNAL_ID_PREFIX } from "@/server/services/shopify-csv-import-service";

/// Arma la página de inicio de Mi tienda con las secciones leídas de la
/// portada de Shopify (ver extractHomeSections en shopify-theme.ts):
/// banners, colección destacada, texto, cuadrícula de categorías, video,
/// productos destacados y columnas informativas. Las colecciones y
/// productos se buscan por su handle de Shopify (por eso se importan
/// antes). Las fotos quedan apuntando a Shopify y las copia el paso de
/// fotos (ver image-rehost-service.ts). Ver conversación del 2026-10-18.

export type ImportSectionResult = { type: SectionType | ShopifyHomeSection["type"]; action: "created" | "skipped" | "error"; reason?: string };

export async function importShopifySections(
  brandId: string,
  data: {
    sections: ShopifyHomeSection[];
    replace: boolean;
    /// handle de Shopify → slug acá (lo devuelve la importación de colecciones).
    collectionSlugByHandle: Record<string, string>;
    pageSlugByHandle?: Record<string, string>;
  },
) {
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { brandId, externalId: { startsWith: EXTERNAL_ID_PREFIX } },
      select: { id: true, externalId: true, slug: true },
    }),
    prisma.brandCollection.findMany({ where: { brandId }, select: { id: true, slug: true } }),
  ]);
  const productByHandle = new Map(products.map((p) => [p.externalId.slice(EXTERNAL_ID_PREFIX.length).toLowerCase(), p]));
  const collectionIdBySlug = new Map(collections.map((c) => [c.slug, c.id]));
  const collectionSlugByHandle = new Map(Object.entries(data.collectionSlugByHandle).map(([h, s]) => [h.toLowerCase(), s]));
  // Una colección que ya existía con el mismo slug que el handle también vale.
  for (const c of collections) if (!collectionSlugByHandle.has(c.slug)) collectionSlugByHandle.set(c.slug, c.slug);
  const productSlugByHandle = new Map<string, string>();
  for (const [handle, p] of productByHandle) if (p.slug) productSlugByHandle.set(handle, p.slug);
  const pageSlugByHandle = new Map(Object.entries(data.pageSlugByHandle ?? {}).map(([h, s]) => [h.toLowerCase(), s]));
  const collectionId = (handle: string) => {
    const slug = collectionSlugByHandle.get(handle.toLowerCase());
    return slug ? (collectionIdBySlug.get(slug) ?? null) : null;
  };
  const link = (href: string) => (href ? (mapShopifyMenuHref(href, { collectionSlugByHandle, productSlugByHandle, pageSlugByHandle }) ?? "") : "");

  let removed = 0;
  if (data.replace) removed = (await prisma.storefrontSection.deleteMany({ where: { brandId } })).count;

  const results: ImportSectionResult[] = [];
  for (const section of data.sections) {
    try {
      let created: { type: SectionType; config: unknown } | null = null;
      switch (section.type) {
        case "BANNER": {
          if (section.images.length === 0) break;
          created = {
            type: "BANNER",
            config: {
              aspectRatio: "original",
              slides: section.images.slice(0, 6).map((imageUrl) => ({ imageUrl, link: "" })),
              title: section.title.slice(0, 120),
              subtitle: section.subtitle.slice(0, 240),
              buttonText: section.buttonText.slice(0, 40),
              buttonLink: link(section.buttonHref),
            },
          };
          break;
        }
        case "FEATURED_COLLECTION": {
          const id = collectionId(section.collectionHandle);
          if (!id) break;
          created = { type: "FEATURED_COLLECTION", config: { collectionId: id, title: section.title.slice(0, 120) } };
          break;
        }
        case "TEXT":
          created = { type: "TEXT", config: { heading: section.heading.slice(0, 120), body: section.body.slice(0, 2000) } };
          break;
        case "CATEGORY_GRID": {
          const items = section.items
            .map((item) => ({ id: collectionId(item.collectionHandle), imageUrl: item.imageUrl, label: item.label.slice(0, 40) }))
            .filter((item): item is { id: string; imageUrl: string | null; label: string } => Boolean(item.id))
            // Varias casillas de Shopify pueden apuntar a colecciones que acá se unieron en una.
            .filter((item, i, list) => list.findIndex((other) => other.id === item.id) === i)
            .slice(0, 6);
          if (items.length === 0) break;
          const padded = Array.from({ length: 6 }, (_, i) =>
            items[i]
              ? { show: true, collectionId: items[i].id, imageUrl: items[i].imageUrl, label: "" }
              : { show: false, collectionId: null, imageUrl: null, label: "" },
          );
          created = { type: "CATEGORY_GRID", config: { title: section.title.slice(0, 120), subtitle: "", items: padded } };
          break;
        }
        case "VIDEO":
          created = { type: "VIDEO", config: { url: section.url.slice(0, 300), title: section.title.slice(0, 120) } };
          break;
        case "FEATURED_PRODUCTS": {
          const productIds = section.productHandles.map((h) => productByHandle.get(h.toLowerCase())?.id).filter((id): id is string => Boolean(id));
          if (productIds.length === 0) break;
          created = { type: "FEATURED_PRODUCTS", config: { title: section.title.slice(0, 80) || "Destacados", display: "carousel", productIds } };
          break;
        }
        case "INFO_COLUMNS": {
          const items = Array.from({ length: 4 }, (_, i) => {
            const column = section.items[i];
            return column
              ? { show: true, icon: "NONE", imageUrl: null, title: column.title.slice(0, 60), description: column.description.slice(0, 120), link: "" }
              : { show: false, icon: "NONE", imageUrl: null, title: "", description: "", link: "" };
          });
          created = { type: "SHIPPING_INFO_BANNERS", config: { items } };
          break;
        }
      }
      if (!created) {
        results.push({ type: section.type, action: "skipped", reason: "No se encontró la colección o el producto al que apunta." });
        continue;
      }
      await createStorefrontSection(brandId, created);
      results.push({ type: created.type, action: "created" });
    } catch (err) {
      console.error(`[portada-shopify] ${section.type}:`, err);
      results.push({
        type: section.type,
        action: "error",
        reason: err instanceof StorefrontSectionError ? err.message : "No se pudo crear esta sección.",
      });
    }
  }
  return { sections: results, removed };
}
