/// Un solo link por marca — no dos. Shopify soporta de fábrica un link que
/// aplica el descuento solo, sin que el cliente tenga que escribir el
/// código (`tienda.dominio/discount/CODIGO`), así que para esas marcas el
/// link directo a la tienda YA lleva el código. WooCommerce no trae nada
/// equivalente (necesitaría un plugin o código adicional en la tienda de
/// cada marca, fuera de nuestro control) — para esas marcas, y para las que
/// no tienen tienda conectada, el link es el normal, sin código. Se usa
/// tanto en "Mis códigos y links" como en el link/logo de la marca dentro
/// de la vitrina pública del creador — misma lógica en los dos lugares.
export function buildBrandStoreLink(
  brand: { storeUrl: string | null; storeType: string; websiteUrl?: string | null },
  discountCode: string
): string | null {
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
/// código (igual que buildBrandStoreLink para esos casos).
export function buildProductLink(
  brand: { storeType: string },
  product: { url: string },
  discountCode: string
): string {
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
