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
///
/// La marca lo elige UNA vez: después queda fijo, porque lo comparten
/// ella, sus creadores y los publishers y cambiarlo rompía todos esos
/// links. Solo Marcolini lo cambia (Admin → Marcas, `byAdmin`), y el
/// link anterior queda en BrandSlugRedirect llevando al nuevo. Ver
/// conversación del 2026-10-01.
export async function saveStorefrontSlug(
  brandId: string,
  slug: string,
  options: { byAdmin?: boolean } = {},
) {
  if (RESERVED_SUBDOMAINS.has(slug)) {
    throw new BrandStoreConfigError(
      "Ese link está reservado — elige otro.",
    );
  }

  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { storefrontSlug: true },
  });
  if (brand.storefrontSlug === slug) return;
  if (brand.storefrontSlug && !options.byAdmin) {
    throw new BrandStoreConfigError(
      "El link de tu tienda ya quedó fijo para no romper los links que ya compartiste. Si necesitas cambiarlo, escríbenos.",
    );
  }

  const [existing, redirect, creator] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { storefrontSlug: slug } }),
    prisma.brandSlugRedirect.findUnique({ where: { slug } }),
    // Las vitrinas de los creadores también viven en {slug}.marcolini.lat.
    prisma.creatorProfile.findUnique({ where: { storefrontSlug: slug }, select: { id: true } }),
  ]);
  if (creator) {
    throw new BrandStoreConfigError("Ese link ya lo tiene un creador — elige otro.");
  }
  // Un link viejo de otra marca tampoco se puede tomar: sigue llevando a
  // esa tienda.
  if ((existing && existing.id !== brandId) || (redirect && redirect.brandId !== brandId)) {
    throw new BrandStoreConfigError(
      "Ese link ya lo tiene otra marca — elige otro.",
    );
  }

  const oldSlug = brand.storefrontSlug;
  await prisma.$transaction([
    // Si la marca vuelve a un link suyo anterior, deja de ser redirección.
    prisma.brandSlugRedirect.deleteMany({ where: { slug } }),
    ...(oldSlug
      ? [
          prisma.brandSlugRedirect.upsert({
            where: { slug: oldSlug },
            create: { slug: oldSlug, brandId },
            update: { brandId },
          }),
        ]
      : []),
    prisma.brandProfile.update({
      where: { id: brandId },
      data: { storefrontSlug: slug },
    }),
    // Los productos de Mi tienda guardan su link (/t/{slug}/{producto});
    // si no se actualiza, quedan apuntando al link anterior o al
    // provisional "mi-tienda" (ver buildStorefrontProductUrl).
    prisma.$executeRaw`UPDATE "Product" SET "url" = '/t/' || ${slug} || '/' || "slug" WHERE "brandId" = ${brandId} AND "manual" = true AND "slug" IS NOT NULL`,
  ]);
}

/// A qué link actual lleva un link viejo de tienda — null si nunca fue de
/// ninguna marca. Ver BrandSlugRedirect.
export async function resolveSlugRedirect(slug: string) {
  const redirect = await prisma.brandSlugRedirect.findUnique({
    where: { slug },
    select: { brand: { select: { storefrontSlug: true } } },
  });
  return redirect?.brand.storefrontSlug ?? null;
}
