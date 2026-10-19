/// El logo de la tienda tal como se muestra en el encabezado: pasado por
/// /api/tienda/{slug}/logo, que le recorta los bordes vacíos (muchos logos
/// vienen en un lienzo grande con la firma chiquita en el medio y se veían
/// diminutos — pedido del 2026-10-19: "el logo sigue muy pequeño"). `v`
/// cambia con el archivo, así un logo nuevo no queda guardado en caché.
/// Los SVG y los data: van tal cual.
export function storefrontLogoSrc(slug: string, logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:") || /\.svg(\?|#|$)/i.test(logoUrl)) return logoUrl;
  let hash = 5381;
  for (let i = 0; i < logoUrl.length; i++) hash = ((hash * 33) ^ logoUrl.charCodeAt(i)) >>> 0;
  return `/api/tienda/${encodeURIComponent(slug)}/logo?v=${hash.toString(36)}`;
}

/// El logo de una marca fuera de su tienda (marketplace, perfil del
/// negocio): recortado igual que en el encabezado si tiene tienda; si no,
/// tal cual. Pedido del 2026-10-19: "el logo no se ve bien ahí" — un logo
/// ancho en un lienzo grande quedaba diminuto y cortado en el círculo.
export function brandLogoSrc(brand: { storefrontSlug: string | null; logoUrl: string | null }): string | null {
  return brand.storefrontSlug ? storefrontLogoSrc(brand.storefrontSlug, brand.logoUrl) : brand.logoUrl;
}
