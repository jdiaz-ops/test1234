import { prisma } from "@/lib/prisma";
import { menuHrefToShopify } from "@/lib/store-scrape";
import type { ShopifyMenuLink, ShopifyThemeInfo } from "@/lib/shopify-theme";
import { readShopifyStorefront } from "@/server/services/shopify-store-reader";
import { StorefrontMenuError } from "@/server/services/store-page-service";
import { buildMenuItems, menuMapsFor, replaceStorefrontMenu, type BuiltMenuItem } from "@/server/services/shopify-collections-import-service";

/// "Traer el menú de la tienda original": lee solo el encabezado de la
/// tienda vieja (Shopify, WooCommerce o la que sea), traduce sus links a
/// lo que ya existe en Marcolini (colecciones, productos, páginas) y
/// reemplaza el menú con sus submenús — sin volver a importar productos
/// ni nada más. Herramienta del administrador en Diseño → Menú. Pedido el
/// 2026-10-19: el menú de Rumi seguía plano porque nadie había vuelto a
/// correr la importación completa.

export type MenuReader = (url: string) => Promise<{ storeUrl: string; theme: Pick<ShopifyThemeInfo, "menu"> }>;

/// Un link del menú en la forma de Shopify (/collections/x, /products/y,
/// /pages/z), venga de la tienda que venga. null = sin equivalente.
export function toShopifyMenuHref(href: string, origin: string, pageHandles: Set<string>): string | null {
  const clean = href.trim();
  if (clean === "" || clean === "#") return "#";
  if (clean === "/" || /^\/(collections|products|pages)(\/|$)/i.test(clean)) return clean;
  return menuHrefToShopify(clean, origin, pageHandles);
}

/// El árbol completo traducido; un padre sin equivalente pero con
/// submenú queda como "#", uno sin equivalente y sin submenú se va (y
/// queda anotado en `dropped`, si se pasa).
export function translateStoreMenu(
  links: ShopifyMenuLink[],
  origin: string,
  pageHandles: Set<string>,
  dropped?: { label: string; href: string }[],
): ShopifyMenuLink[] {
  return links.flatMap((link) => {
    const children = link.children ? translateStoreMenu(link.children, origin, pageHandles, dropped) : [];
    const href = toShopifyMenuHref(link.href, origin, pageHandles) ?? (children.length > 0 ? "#" : null);
    if (href === null) {
      dropped?.push({ label: link.label, href: link.href });
      return [];
    }
    return [children.length > 0 ? { label: link.label, href, children } : { label: link.label, href }];
  });
}

function countLinks(links: ShopifyMenuLink[]): number {
  return links.reduce((n, l) => n + 1 + countLinks(l.children ?? []), 0);
}

export type MenuImportPreview = {
  storeUrl: string;
  /// Cuántos links tiene el menú de la tienda original (con submenús).
  read: number;
  /// Lo que quedaría en Marcolini.
  items: BuiltMenuItem[];
  /// Links sin equivalente acá (una página que no se importó, un blog…).
  dropped: { label: string; href: string }[];
  /// Cuántos ítems tiene el menú actual.
  current: number;
};

export async function previewMenuImport(brandId: string, url: string, reader: MenuReader = readShopifyStorefront): Promise<MenuImportPreview> {
  const { storeUrl, theme } = await reader(url);
  const pages = await prisma.storePage.findMany({ where: { brandId }, select: { slug: true } });
  const pageHandles = new Set(pages.map((p) => p.slug.toLowerCase()));
  const dropped: { label: string; href: string }[] = [];
  const links = translateStoreMenu(theme.menu, storeUrl, pageHandles, dropped);
  const maps = await menuMapsFor(
    brandId,
    pages.map((p) => ({ handle: p.slug, slug: p.slug })),
  );
  const built = buildMenuItems(links, maps);
  const current = await prisma.storefrontMenuItem.count({ where: { brandId } });
  return { storeUrl, read: countLinks(theme.menu), items: built.items, dropped: [...dropped, ...built.dropped], current };
}

export async function applyMenuImport(brandId: string, url: string, reader: MenuReader = readShopifyStorefront) {
  const preview = await previewMenuImport(brandId, url, reader);
  if (preview.items.length === 0) {
    throw new StorefrontMenuError(
      preview.read === 0
        ? "No se encontró un menú en el encabezado de esa tienda."
        : "El menú de esa tienda no tiene links con equivalente en Marcolini (importa primero las colecciones y las páginas).",
    );
  }
  const applied = await replaceStorefrontMenu(brandId, preview.items, true);
  return { ...preview, applied };
}
