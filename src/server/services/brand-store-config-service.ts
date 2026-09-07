import { prisma } from "@/lib/prisma";
import { RESERVED_SUBDOMAINS } from "@/lib/subdomain";

export class BrandStoreConfigError extends Error {}

export async function saveShippingConfig(
  userId: string,
  data: {
    shippingFlatRate?: number | null;
    freeShippingThreshold?: number | null;
    shippingNotes?: string;
  },
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      shippingFlatRate: data.shippingFlatRate ?? null,
      freeShippingThreshold: data.freeShippingThreshold ?? null,
      shippingNotes: data.shippingNotes || null,
    },
  });
}

/// El slug de la vitrina pública de "Mi tienda" — único en toda la
/// plataforma, y ahora también el subdominio real de la marca
/// ({slug}.marcolini.lat, ver src/proxy.ts) además del link viejo
/// marcolini.lat/t/{slug}, que se sigue sirviendo pero redirige al
/// subdominio. Por eso, aparte de la disponibilidad (igual que
/// CreatorProfile.storefrontSlug al registrarse), tampoco puede ser una
/// palabra reservada — sería un subdominio real chocando con
/// infraestructura de Marcolini.
export async function saveStorefrontSlug(
  userId: string,
  brandId: string,
  slug: string,
) {
  if (RESERVED_SUBDOMAINS.has(slug)) {
    throw new BrandStoreConfigError(
      "Ese link está reservado — elige otro.",
    );
  }

  const existing = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
  if (existing && existing.id !== brandId) {
    throw new BrandStoreConfigError(
      "Ese link ya lo tiene otra marca — elige otro.",
    );
  }

  return prisma.brandProfile.update({
    where: { userId },
    data: { storefrontSlug: slug },
  });
}

/// Plantilla visual del catálogo de Mi tienda — ver StorefrontTemplate en
/// el schema y src/components/storefront/catalog-templates/.
export async function saveStorefrontTemplate(
  userId: string,
  template: "CLASICA" | "MINIMAL" | "EDITORIAL",
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: { storefrontTemplate: template },
  });
}
