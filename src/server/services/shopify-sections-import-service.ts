import { prisma } from "@/lib/prisma";
import { type SectionType } from "@/lib/storefront-sections";
import { mapShopifyMenuHref, type ShopifyHomeSection } from "@/lib/shopify-theme";
import { createStorefrontSection, StorefrontSectionError } from "@/server/services/storefront-section-service";
import { EXTERNAL_ID_PREFIX } from "@/server/services/shopify-csv-import-service";
import { completeHomeSections } from "@/server/services/storefront-default-home-service";
import { slugify } from "@/lib/shopify-csv";
import { remapStoreLinks } from "@/lib/store-link-map";
import { sanitizeProductDescription } from "@/lib/sanitize-html";

/// Arma la página de inicio de Mi tienda con las secciones leídas de la
/// portada de Shopify (ver extractHomeSections en shopify-theme.ts):
/// banners, colección destacada, texto, cuadrícula de categorías, video,
/// productos destacados y columnas informativas. Las colecciones y
/// productos se buscan por su handle de Shopify (por eso se importan
/// antes). Las fotos quedan apuntando a Shopify y las copia el paso de
/// fotos (ver image-rehost-service.ts). Ver conversación del 2026-10-18.
///
/// Con `fillGaps` (la importación por link): si al final la portada quedó
/// vacía (no se reconoció nada) se agregan las de la portada básica —
/// categorías, novedades y catálogo, ver storefront-default-home-service.ts
/// — para que una tienda importada nunca quede en blanco (Rumi, amglow).
/// Si se copió algo, queda tal cual la original aunque no muestre
/// productos: es una copia fiel (2026-10-19), y Diseño ofrece agregarlos.
///
/// CUSTOM_BLOCK es lo que la tienda original tenía y no calza en ninguna
/// sección de acá (ver home-copy.ts): entra como "Bloque personalizado",
/// con sus colores, y la marca lo edita como cualquier otra sección.

export type ImportSectionResult = { type: SectionType | ShopifyHomeSection["type"]; action: "created" | "skipped" | "error"; reason?: string };

function nameKey(name: string) {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function importShopifySections(
  brandId: string,
  data: {
    sections: ShopifyHomeSection[];
    replace: boolean;
    /// handle de Shopify → slug acá (lo devuelve la importación de colecciones).
    collectionSlugByHandle: Record<string, string>;
    pageSlugByHandle?: Record<string, string>;
    fillGaps?: boolean;
    /// Con `storeUrl`, los links de las páginas recién importadas que
    /// apuntaban a la tienda vieja se reescriben hacia acá (ver
    /// store-link-map.ts).
    storeUrl?: string;
    relinkPages?: boolean;
    /// Copia fiel (la leyó la IA, ver home-copy.ts): un título vacío es
    /// que la original no tenía, así que no se le pone "Destacados".
    faithful?: boolean;
  },
) {
  const titled = (title: string, max: number, fallback: string) => title.slice(0, max) || (data.faithful ? "" : fallback);
  const [products, collections] = await Promise.all([
    prisma.product.findMany({
      where: { brandId, externalId: { startsWith: EXTERNAL_ID_PREFIX } },
      select: { id: true, externalId: true, slug: true },
    }),
    prisma.brandCollection.findMany({ where: { brandId }, select: { id: true, slug: true, name: true } }),
  ]);
  const productByHandle = new Map(products.map((p) => [p.externalId.slice(EXTERNAL_ID_PREFIX.length).toLowerCase(), p]));
  const collectionIdBySlug = new Map(collections.map((c) => [c.slug, c.id]));
  const collectionIdByName = new Map(collections.map((c) => [nameKey(c.name), c.id]));
  const collectionSlugByHandle = new Map(Object.entries(data.collectionSlugByHandle).map(([h, s]) => [h.toLowerCase(), s]));
  // Una colección que ya existía con el mismo slug que el handle también vale.
  for (const c of collections) if (!collectionSlugByHandle.has(c.slug)) collectionSlugByHandle.set(c.slug, c.slug);
  const productSlugByHandle = new Map<string, string>();
  for (const [handle, p] of productByHandle) if (p.slug) productSlugByHandle.set(handle, p.slug);
  const pageSlugByHandle = new Map(Object.entries(data.pageSlugByHandle ?? {}).map(([h, s]) => [h.toLowerCase(), s]));
  // Por handle; si no, por el nombre que mostraba la tienda vieja (en una
  // tienda WooCommerce el slug de la URL y el nombre de la categoría
  // pueden no coincidir).
  const collectionSlug = (handle: string, label = "") => {
    const slug = collectionSlugByHandle.get(handle.toLowerCase());
    if (slug && collectionIdBySlug.has(slug)) return slug;
    const name = label.trim();
    if (!name) return null;
    if (collectionIdBySlug.has(slugify(name))) return slugify(name);
    const id = collectionIdByName.get(nameKey(name));
    return id ? (collections.find((c) => c.id === id)?.slug ?? null) : null;
  };
  const collectionId = (handle: string, label = "") => {
    const slug = collectionSlug(handle, label);
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
              slides: section.images.slice(0, 6).map((imageUrl, i) => ({ imageUrl, link: link(section.links?.[i] ?? "") })),
              title: section.title.slice(0, 120),
              subtitle: section.subtitle.slice(0, 240),
              buttonText: section.buttonText.slice(0, 40),
              buttonLink: link(section.buttonHref),
            },
          };
          break;
        }
        case "FEATURED_COLLECTION": {
          const id = collectionId(section.collectionHandle, section.title);
          if (!id) break;
          created = { type: "FEATURED_COLLECTION", config: { collectionId: id, title: section.title.slice(0, 120) } };
          break;
        }
        case "TEXT":
          created = { type: "TEXT", config: { heading: section.heading.slice(0, 120), body: section.body.slice(0, 2000) } };
          break;
        case "CATEGORY_GRID": {
          const items = section.items
            .map((item) => ({ id: collectionId(item.collectionHandle, item.label), imageUrl: item.imageUrl, label: item.label.slice(0, 40) }))
            .filter((item): item is { id: string; imageUrl: string | null; label: string } => Boolean(item.id))
            // Varias casillas de Shopify pueden apuntar a colecciones que acá se unieron en una.
            .filter((item, i, list) => list.findIndex((other) => other.id === item.id) === i)
            .slice(0, 6);
          if (items.length === 0) break;
          // El nombre que mostraba la tienda original (vacío = el de la colección).
          const padded = Array.from({ length: 6 }, (_, i) =>
            items[i]
              ? { show: true, collectionId: items[i].id, imageUrl: items[i].imageUrl, label: items[i].label }
              : { show: false, collectionId: null, imageUrl: null, label: "" },
          );
          created = {
            type: "CATEGORY_GRID",
            config: {
              title: section.title.slice(0, 120),
              subtitle: (section.subtitle ?? "").slice(0, 240),
              // Si ninguna casilla de la original tenía texto (el nombre va
              // escrito en la foto), tampoco acá.
              showLabels: items.some((item) => item.label.trim().length > 0),
              items: padded,
            },
          };
          break;
        }
        case "VIDEO":
          created = { type: "VIDEO", config: { url: section.url.slice(0, 300), title: section.title.slice(0, 120) } };
          break;
        case "FEATURED_PRODUCTS": {
          const productIds = section.productHandles.map((h) => productByHandle.get(h.toLowerCase())?.id).filter((id): id is string => Boolean(id));
          if (productIds.length === 0) break;
          created = { type: "FEATURED_PRODUCTS", config: { title: titled(section.title, 80, "Destacados"), display: "carousel", productIds: productIds.slice(0, 24) } };
          break;
        }
        case "CATEGORY_BANNERS": {
          const items = section.items
            .map((item) => ({ id: collectionId(item.collectionHandle, item.label), imageUrl: item.imageUrl }))
            .filter((item): item is { id: string; imageUrl: string | null } => Boolean(item.id))
            .filter((item, i, list) => list.findIndex((other) => other.id === item.id) === i)
            .slice(0, 3);
          if (items.length === 0) break;
          const padded = Array.from({ length: 3 }, (_, i) =>
            items[i] ? { show: true, collectionId: items[i].id, imageUrl: items[i].imageUrl } : { show: false, collectionId: null, imageUrl: null },
          );
          created = { type: "CATEGORY_BANNERS", config: { extendFullWidth: false, items: padded } };
          break;
        }
        case "PROMO_BANNERS": {
          const items = section.items.filter((item) => item.imageUrl).slice(0, 3);
          if (items.length === 0) break;
          const padded = Array.from({ length: 3 }, (_, i) =>
            items[i] ? { show: true, imageUrl: items[i].imageUrl, link: link(items[i].link) } : { show: false, imageUrl: null, link: "" },
          );
          created = { type: "PROMO_BANNERS", config: { extendFullWidth: false, items: padded } };
          break;
        }
        case "CUSTOM_BLOCK": {
          const items = section.items.slice(0, 12).map((item) => ({
            imageUrl: item.imageUrl ?? "",
            title: item.title.slice(0, 160),
            text: item.text.slice(0, 1200),
            buttonText: item.buttonText.slice(0, 40),
            link: link(item.link),
          }));
          if (!section.title && !section.text && !section.imageUrl && items.length === 0) break;
          const hex = (value: string | null) => (value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "");
          created = {
            type: "CUSTOM_BLOCK",
            config: {
              name: section.name.slice(0, 60),
              layout: section.layout,
              title: section.title.slice(0, 160),
              text: section.text.slice(0, 2000),
              buttonText: section.buttonText.slice(0, 40),
              buttonLink: link(section.buttonHref),
              imageUrl: section.imageUrl ?? "",
              imagePosition: section.imagePosition,
              columns: Math.max(1, Math.min(6, Math.round(section.columns) || 3)),
              align: section.align,
              background: hex(section.background),
              textColor: hex(section.textColor),
              items,
            },
          };
          break;
        }
        case "NEW_PRODUCTS":
          created = { type: "NEW_PRODUCTS", config: { title: titled(section.title, 80, "Novedades"), display: "carousel" } };
          break;
        case "ON_SALE_PRODUCTS":
          created = {
            type: "ON_SALE_PRODUCTS",
            config: { title: titled(section.title, 80, "Ofertas"), display: "carousel", source: "auto", collectionId: null, productIds: [] },
          };
          break;
        case "PRODUCT_CATALOG":
          created = { type: "PRODUCT_CATALOG", config: { title: section.title.slice(0, 120) } };
          break;
        case "IMAGE_CAROUSEL":
          if (section.images.length === 0) break;
          created = { type: "IMAGE_CAROUSEL", config: { images: section.images.slice(0, 8) } };
          break;
        case "BRAND_CAROUSEL":
          if (section.items.length === 0) break;
          created = { type: "BRAND_CAROUSEL", config: { items: section.items.slice(0, 12).map((item) => ({ imageUrl: item.imageUrl, link: link(item.link) })) } };
          break;
        case "INSTAGRAM_CTA":
          created = {
            type: "INSTAGRAM_CTA",
            config: { title: titled(section.title, 80, "Síguenos en Instagram"), description: section.description.slice(0, 160) },
          };
          break;
        case "INFO_COLUMNS": {
          const items = Array.from({ length: 4 }, (_, i) => {
            const column = section.items[i];
            return column
              ? {
                  show: true,
                  icon: "NONE",
                  imageUrl: column.imageUrl ?? null,
                  title: column.title.slice(0, 60),
                  description: column.description.slice(0, 120),
                  link: link(column.link ?? ""),
                }
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

  // Los links de las páginas importadas que apuntaban a la tienda vieja
  // (productos, categorías, otras páginas) se reescriben hacia acá.
  let relinked = 0;
  if (data.relinkPages && data.storeUrl && pageSlugByHandle.size > 0) {
    const resolvers = {
      storeUrl: data.storeUrl,
      product: (handle: string) => productSlugByHandle.get(handle) ?? null,
      collection: (handle: string) => collectionSlug(handle),
      page: (handle: string) => pageSlugByHandle.get(handle) ?? null,
    };
    const pages = await prisma.storePage.findMany({
      where: { brandId, slug: { in: Array.from(new Set(pageSlugByHandle.values())) } },
      select: { id: true, body: true },
    });
    for (const page of pages) {
      if (!page.body) continue;
      const { html, changed } = remapStoreLinks(page.body, resolvers);
      if (changed === 0) continue;
      await prisma.storePage.update({ where: { id: page.id }, data: { body: sanitizeProductDescription(html) } });
      relinked++;
    }
  }

  // Que la portada nunca quede vacía.
  let basic = 0;
  if (data.fillGaps) {
    const enabled = await prisma.storefrontSection.count({ where: { brandId, enabled: true } });
    if (enabled === 0) {
      const home = await completeHomeSections(brandId);
      for (const type of home.created) results.push({ type, action: "created" });
      basic = home.created.length;
    }
  }
  return { sections: results, removed, basic, relinked };
}
