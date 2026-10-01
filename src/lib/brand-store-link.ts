import { publicStoreUrl } from "@/lib/store-url";

/// Un solo link por marca — no dos. Shopify soporta de fábrica un link que
/// aplica el descuento solo, sin que el cliente tenga que escribir el
/// código (`tienda.dominio/discount/CODIGO`), así que para esas marcas el
/// link directo a la tienda YA lleva el código. WooCommerce no trae nada
/// equivalente (necesitaría un plugin o código adicional en la tienda de
/// cada marca, fuera de nuestro control) — para esas marcas, y para las que
/// no tienen tienda conectada, el link es el normal, sin código. Se usa
/// tanto en "Mis códigos y links" como en el link/logo de la marca dentro
/// de la vitrina pública del creador — misma lógica en los dos lugares.
///
/// Si la marca ya tiene su tienda dentro de Marcolini ({slug}.marcolini.lat),
/// esa gana siempre — con ?ref= para que la venta quede a nombre del
/// creador (ver src/proxy.ts). Antes se usaba la tienda Shopify conectada
/// aunque la marca ya vendiera en Marcolini, y el botón "Ir a la tienda"
/// de la vitrina llevaba a una tienda vieja o cerrada (2026-10-01).
export function buildBrandStoreLink(
  brand: {
    storeUrl: string | null;
    storeType: string;
    websiteUrl?: string | null;
    storefrontSlug: string | null;
    customDomain: string | null;
    customDomainVerifiedAt: Date | null;
  },
  discountCode: string
): string | null {
  const nativeStore = publicStoreUrl(brand);
  if (nativeStore) return `${nativeStore}/?ref=${encodeURIComponent(discountCode)}`;
  if (brand.storeType === "SHOPIFY" && brand.storeUrl) {
    try {
      const host = new URL(brand.storeUrl).host;
      return `https://${host}/discount/${encodeURIComponent(discountCode)}`;
    } catch {
      return brand.storeUrl;
    }
  }
  return brand.storeUrl || brand.websiteUrl || null;
}

/// Misma idea que buildBrandStoreLink, pero apuntando a un producto puntual
/// en vez de la tienda en general — para las tarjetas de producto de las
/// colecciones y del catálogo. En Shopify usa el parámetro `redirect` del
/// mismo link nativo de descuento, así llega directo al producto CON el
/// código ya aplicado. En el resto, es el link real del producto, sin
/// código (igual que buildBrandStoreLink para esos casos) — EXCEPTO
/// cuando el producto vive en Mi tienda (product.url empieza con "/t/",
/// nuestro propio checkout): ahí sí podemos dejar un rastro con `?ref=`,
/// que src/proxy.ts convierte en una cookie de primera parte al aterrizar
/// — así, si el comprador navega un rato y paga sin escribir el código a
/// mano, la venta igual se le atribuye a este creador (ver
/// checkout-form.tsx, que la lee y la aplica sola). No hace falta esto
/// para Shopify/WooCommerce reales: esos ya sea llevan el código puesto
/// (Shopify) o no son first-party (no hay cookie de Marcolini posible ahí).
export function buildProductLink(
  brand: {
    storeType: string;
    storefrontSlug: string | null;
    customDomain: string | null;
    customDomainVerifiedAt: Date | null;
  },
  product: { url: string; slug: string | null; manual: boolean },
  discountCode: string | null,
): string {
  // Producto de Mi tienda: el link se arma con el link ACTUAL de la tienda,
  // no con product.url — ese se guardó al crear el producto y puede tener
  // un link viejo (ej. "/t/mi-tienda/…" si se creó antes de que la marca
  // eligiera el suyo), que terminaba en una página 404 (2026-10-01).
  // Absoluto: la vitrina vive en {creador}.marcolini.lat.
  if (product.manual || product.url.startsWith("/t/")) {
    const store = publicStoreUrl(brand);
    const path = product.slug ?? product.url.split("/").filter(Boolean).slice(2).join("/");
    if (store) {
      return `${store}/${path}${discountCode ? `?ref=${encodeURIComponent(discountCode)}` : ""}`;
    }
    return product.url;
  }
  if (!discountCode) return product.url;
  if (brand.storeType === "SHOPIFY") {
    try {
      const target = new URL(product.url);
      return `https://${target.host}/discount/${encodeURIComponent(discountCode)}?redirect=${encodeURIComponent(
        target.pathname
      )}`;
    } catch {
      return product.url;
    }
  }
  return product.url;
}
