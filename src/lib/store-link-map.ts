import { decodeHtmlEntities } from "@/lib/html-entities";
import { handleFromUrl, isCategoryUrl, isProductUrl, sameSiteUrl } from "@/lib/store-scrape";

/// Reescribe los links de la tienda vieja dentro de un HTML (el cuerpo de
/// una página importada) para que apunten a Marcolini: un producto a
/// /{slug}, una categoría a /coleccion/{slug}, una página a /pagina/{slug},
/// el catálogo a /coleccion, el inicio a /. Un link a algo que no existe
/// acá (carrito, cuenta, una página que no se importó) se quita y queda el
/// texto; los links a otros sitios (WhatsApp, Instagram) se dejan. Sirve
/// para Shopify (/products/x, /collections/x, /pages/x, /policies/x) y
/// para WooCommerce y otras (/producto/x, /categoria-producto/x, /x).
/// Pedido el 2026-10-18: la importación debe recrear toda la tienda, no
/// mandar a la gente a la tienda vieja.
export type StoreLinkResolvers = {
  storeUrl: string;
  /// handle (último tramo de la URL, en slug) → slug acá; null si no existe.
  product: (handle: string) => string | null;
  collection: (handle: string) => string | null;
  page: (handle: string) => string | null;
};

const CATALOG_PATH_RE = /^\/(?:tienda|shop|productos|products|catalogo|cat[aá]logo|collections(?:\/all)?)\/?$/i;

export function mapStoreLink(href: string, resolvers: StoreLinkResolvers): string | null | "keep" {
  const value = decodeHtmlEntities(href.trim());
  if (!value || value.startsWith("#") || /^(?:mailto|tel|javascript|sms|whatsapp):/i.test(value)) return "keep";
  let url: URL;
  try {
    url = new URL(value, resolvers.storeUrl);
  } catch {
    return "keep";
  }
  if (!/^https?:$/.test(url.protocol)) return "keep";
  if (!sameSiteUrl(url, resolvers.storeUrl)) return "keep";
  if (/add-to-cart|añadir|agregar/i.test(url.search)) return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "/";
  if (CATALOG_PATH_RE.test(path)) return "/coleccion";
  const handle = handleFromUrl(url.href);
  const shopifyProduct = /\/products\/[^/]+$/i.test(path);
  const shopifyCollection = /\/collections\/[^/]+$/i.test(path);
  const shopifyPage = path.match(/^\/pages\/([^/]+)$/i);
  const shopifyPolicy = path.match(/^\/policies\/([^/]+)$/i);
  if (shopifyProduct || isProductUrl(url.href) || /\/(?:products?|productos?|producto|p)\/[^/]+/i.test(path)) {
    const slug = resolvers.product(handle);
    return slug ? `/${slug}` : null;
  }
  if (shopifyCollection || isCategoryUrl(url.href) || /\/(?:product-category|categoria-producto|collections|categorias?|categor(?:y|ies))\/[^/]+/i.test(path)) {
    if (handle === "all") return "/coleccion";
    const slug = resolvers.collection(handle);
    return slug ? `/coleccion/${slug}` : "/coleccion";
  }
  const pageHandle = shopifyPage?.[1] ?? shopifyPolicy?.[1] ?? handle;
  const slug = resolvers.page(pageHandle.toLowerCase());
  return slug ? `/pagina/${slug}` : null;
}

/// Reescribe cada href="…" del HTML; devuelve el HTML y cuántos links se
/// cambiaron (reescritos o quitados).
export function remapStoreLinks(html: string, resolvers: StoreLinkResolvers): { html: string; changed: number } {
  let changed = 0;
  const out = html.replace(/\shref=(["\'])([^"\']*)\1/gi, (whole, quote: string, raw: string) => {
    const mapped = mapStoreLink(raw, resolvers);
    if (mapped === "keep") return whole;
    changed++;
    return mapped == null ? "" : ` href=${quote}${mapped}${quote}`;
  });
  return { html: out, changed };
}
