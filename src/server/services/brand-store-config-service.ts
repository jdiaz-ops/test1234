import { prisma } from "@/lib/prisma";
import { RESERVED_SUBDOMAINS } from "@/lib/subdomain";

export class BrandStoreConfigError extends Error {}

/// Ya no toca shippingFlatRate/freeShippingThreshold — quedaron solo por
/// compatibilidad con pedidos viejos (ver el comentario en el schema),
/// esto solo guarda las notas que ve el comprador en el checkout.
export async function saveShippingConfig(
  userId: string,
  data: { shippingNotes?: string },
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: { shippingNotes: data.shippingNotes || null },
  });
}

/// Centro de distribución — de dónde despacha la marca y cuántos días
/// hábiles tarda en alistar el pedido antes de que salga. Ver
/// conversación del 2026-09-14, referencia de Tiendanube.
export async function saveDistributionCenter(
  userId: string,
  data: {
    originAddress?: string;
    originCity?: string;
    originRegion?: string;
    fulfillmentLeadDays: number;
  },
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      originAddress: data.originAddress || null,
      originCity: data.originCity || null,
      originRegion: data.originRegion || null,
      fulfillmentLeadDays: data.fulfillmentLeadDays,
    },
  });
}

/// Mercado (por ahora solo "CO" — Colombia, igual que Tiendanube deja
/// elegir el país pero acá arranca fijo) y tasa de IVA aplicada en el
/// checkout nativo (createStoreOrder) — 10% por defecto. Ver conversación
/// del 2026-09-14: "en configuración que puedan configurar el mercado...
/// son el 10% de iva por defecto".
export async function saveTaxConfig(
  userId: string,
  data: { market: string; taxRatePercent: number },
) {
  if (data.taxRatePercent < 0 || data.taxRatePercent > 100) {
    throw new BrandStoreConfigError("La tasa de IVA debe estar entre 0 y 100.");
  }
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      market: data.market.trim() || "CO",
      taxRatePercent: data.taxRatePercent,
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
