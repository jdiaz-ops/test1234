import { ROOT_DOMAIN } from "@/lib/subdomain";

/// Dirección pública de la tienda de una marca: el dominio propio si ya
/// está activo (abre la tienda de verdad, ver customDomainActiveAt), si no
/// el subdominio gratis. Con el dominio solo verificado todavía no: el DNS
/// puede no apuntar y los links quedarían rotos. null si todavía no tiene
/// storefrontSlug. Una sola definición para links de productos,
/// colecciones, correos, pagos y el mapa del sitio.
export function publicStoreUrl(brand: {
  customDomain: string | null;
  customDomainActiveAt: Date | null;
  storefrontSlug: string | null;
}): string | null {
  if (brand.customDomain && brand.customDomainActiveAt) return `https://${brand.customDomain}`;
  if (brand.storefrontSlug) return `https://${brand.storefrontSlug}.${ROOT_DOMAIN}`;
  return null;
}

/// La dirección oficial de una página de la tienda (<link rel="canonical">),
/// para que Google no parta el posicionamiento entre el subdominio y el
/// dominio propio: siempre la de publicStoreUrl. `path` empieza con "/".
export function storeCanonical(
  brand: Parameters<typeof publicStoreUrl>[0],
  path: string,
): { canonical: string } | undefined {
  const store = publicStoreUrl(brand);
  return store ? { canonical: `${store}${path}` } : undefined;
}

/// Dirección del portal (donde entra la marca), para los links de los
/// correos que le llegan.
export function portalUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured && !configured.includes("localhost")) return configured.replace(/\/$/, "");
  return `https://${ROOT_DOMAIN}`;
}
