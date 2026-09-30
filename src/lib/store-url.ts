import { ROOT_DOMAIN } from "@/lib/subdomain";

/// Dirección pública de la tienda de una marca: el dominio propio si ya
/// está verificado, si no el subdominio gratis. null si todavía no tiene
/// storefrontSlug. Una sola definición para links de productos,
/// colecciones y correos.
export function publicStoreUrl(brand: {
  customDomain: string | null;
  customDomainVerifiedAt: Date | null;
  storefrontSlug: string | null;
}): string | null {
  if (brand.customDomain && brand.customDomainVerifiedAt) return `https://${brand.customDomain}`;
  if (brand.storefrontSlug) return `https://${brand.storefrontSlug}.${ROOT_DOMAIN}`;
  return null;
}

/// Dirección del portal (donde entra la marca), para los links de los
/// correos que le llegan.
export function portalUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured && !configured.includes("localhost")) return configured.replace(/\/$/, "");
  return `https://${ROOT_DOMAIN}`;
}
