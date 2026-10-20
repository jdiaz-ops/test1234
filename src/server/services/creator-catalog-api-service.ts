import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBrandStoreLink, buildProductLink } from "@/lib/brand-store-link";
import { creatorVitrinaUrl } from "@/lib/creator-identity";
import { IN_STOCK_WHERE } from "@/lib/product-stock";
import { portalUrl, publicStoreUrl } from "@/lib/store-url";

/// Lo que devuelve la API de catálogo para creadoras (GET /api/v1/catalogo,
/// ver docs/api-catalogo.md): las marcas que tienen a la creadora ACTIVE
/// —la aceptaron, o su oferta era abierta— con su código, descuento y
/// comisión de hoy, y los productos que esas marcas tienen a la venta, cada
/// uno con el link que le atribuye la venta. Pedido del 2026-10-20 para la
/// cuponera de Nail Fest.

export const CATALOG_API_VERSION = 1;
export const CATALOG_DEFAULT_LIMIT = 500;
export const CATALOG_MAX_LIMIT = 1000;

export class CreatorCatalogError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/// Una marca con la creadora vinculada igual queda afuera si Marcolini
/// mismo no la está promoviendo: en Nivel 3 (sus códigos ya no atribuyen
/// ventas — la vitrina también la esconde), pausada o rechazada por el
/// admin, u oculta a la fuerza. Las de prueba con FORCE_VISIBLE sí salen
/// (mismo criterio que listActiveOffers en marketplace-service.ts).
const PROMOTABLE_BRAND_WHERE: Prisma.BrandProfileWhereInput = {
  marketplaceVisibilityOverride: { not: "FORCE_HIDDEN" },
  charges: { none: { status: "DEACTIVATED" } },
  OR: [{ status: "APPROVED" }, { marketplaceVisibilityOverride: "FORCE_VISIBLE" }],
};

const BRAND_SELECT = {
  id: true,
  companyName: true,
  logoUrl: true,
  description: true,
  city: true,
  instagramHandle: true,
  tiktokHandle: true,
  websiteUrl: true,
  storeUrl: true,
  storeType: true,
  storefrontSlug: true,
  customDomain: true,
  customDomainActiveAt: true,
} satisfies Prisma.BrandProfileSelect;

type CampaignConfig = { newDiscountPercent?: number; newCommissionPercent?: number };

export type CatalogCampaign = {
  name: string;
  discountPercent: number | null;
  commissionPercent: number | null;
  startsAt: string;
  endsAt: string;
};

export type CatalogBrand = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  city: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  /// Link a la tienda con el código de la creadora puesto cuando la
  /// plataforma lo permite (ver buildBrandStoreLink). null = la marca
  /// todavía no tiene tienda ni sitio web.
  storeUrl: string | null;
  /// MARCOLINI = su tienda vive en Marcolini; si no, la plataforma
  /// conectada (SHOPIFY, WOOCOMMERCE u OTHER).
  storeKind: "MARCOLINI" | "SHOPIFY" | "WOOCOMMERCE" | "OTHER";
  /// true = el link ya aplica el código solo (Mi tienda con ?ref=, Shopify
  /// con /discount/); false = la compradora tiene que escribirlo al pagar.
  codeAppliedByLink: boolean;
  discountCode: string;
  /// El % que ve la compradora hoy — ya con la campaña, si hay una subida.
  discountPercent: number;
  commissionPercent: number;
  campaign: CatalogCampaign | null;
  /// Cómo la tiene la creadora en su vitrina de Marcolini (orden y si la
  /// muestra) — sirve de punto de partida para ordenar en otro sitio.
  visibleInVitrina: boolean;
  vitrinaOrder: number;
  joinedAt: string;
  productCount: number;
};

export type CatalogProduct = {
  id: string;
  brandId: string;
  name: string;
  imageUrl: string | null;
  images: string[];
  /// Menor precio de venta (con variantes, la más barata con stock).
  price: number;
  /// Mayor precio cuando las variantes cuestan distinto; null si es uno solo.
  priceMax: number | null;
  /// Precio tachado de la tienda, solo si es mayor que price.
  compareAtPrice: number | null;
  currency: string;
  /// Link al producto que le atribuye la venta a la creadora.
  url: string;
  /// Categoría de la tienda (solo WooCommerce la trae) y colecciones de la
  /// marca en Mi tienda — pistas para clasificarlo del otro lado.
  category: string | null;
  collections: string[];
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreatorCatalog = {
  version: number;
  generatedAt: string;
  creator: { displayName: string; storefrontSlug: string; vitrinaUrl: string };
  brands: CatalogBrand[];
  products: CatalogProduct[];
  /// Para pedir la página siguiente (?cursor=); null = no hay más.
  nextCursor: string | null;
};

function clampLimit(limit: number | null | undefined) {
  if (!limit || !Number.isFinite(limit)) return CATALOG_DEFAULT_LIMIT;
  return Math.min(CATALOG_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

/// Las fotos guardadas como ruta ("/uploads/…") salen con el dominio de
/// Marcolini — afuera no hay cómo resolverlas.
function absoluteUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${portalUrl()}${url}` : url;
}

function activeCampaign(
  challenges: { name: string; config: Prisma.JsonValue; discountBoostActive: boolean; startDate: Date; endDate: Date }[],
): CatalogCampaign | null {
  for (const challenge of challenges) {
    const cfg = (challenge.config ?? {}) as CampaignConfig;
    // El descuento solo cuenta una vez que de verdad se subió en la tienda
    // (discountBoostActive, ver applyDiscountBoost en challenge-service.ts);
    // la comisión se calcula al vuelo, así que basta con estar en fechas.
    const discountPercent = challenge.discountBoostActive && cfg.newDiscountPercent != null ? Number(cfg.newDiscountPercent) : null;
    const commissionPercent = cfg.newCommissionPercent != null ? Number(cfg.newCommissionPercent) : null;
    if (discountPercent == null && commissionPercent == null) continue;
    return {
      name: challenge.name,
      discountPercent,
      commissionPercent,
      startsAt: challenge.startDate.toISOString(),
      endsAt: challenge.endDate.toISOString(),
    };
  }
  return null;
}

function priceSpan(product: {
  price: Prisma.Decimal;
  hasVariants: boolean;
  variants: { price: Prisma.Decimal | null; stock: number | null }[];
}): { min: number; max: number } {
  const base = Number(product.price);
  if (!product.hasVariants || product.variants.length === 0) return { min: base, max: base };
  const sellable = product.variants.filter((v) => v.stock == null || v.stock > 0);
  const prices = (sellable.length > 0 ? sellable : product.variants)
    .map((v) => (v.price == null ? base : Number(v.price)))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return { min: base, max: base };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export async function getCreatorCatalog(
  storefrontSlug: string,
  options: { cursor?: string | null; limit?: number | null; now?: Date } = {},
): Promise<CreatorCatalog> {
  const now = options.now ?? new Date();
  const limit = clampLimit(options.limit);

  const creator = await prisma.creatorProfile.findUnique({
    where: { storefrontSlug },
    select: { id: true, displayName: true, storefrontSlug: true, suspended: true },
  });
  // Una llave configurada con un slug que no existe es un error de
  // configuración, no de quien llama — igual no se cuenta nada más.
  if (!creator) throw new CreatorCatalogError("La llave apunta a una vitrina que no existe en Marcolini.", 404);
  if (creator.suspended) throw new CreatorCatalogError("Esta cuenta de creadora está suspendida.", 403);

  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { creatorId: creator.id, status: "ACTIVE", offer: { brand: PROMOTABLE_BRAND_WHERE } },
    select: {
      discountCode: true,
      discountPercentOverride: true,
      commissionPercentOverride: true,
      storefrontVisible: true,
      storefrontOrder: true,
      joinedAt: true,
      offer: {
        select: {
          defaultDiscountPercent: true,
          defaultCommissionPercent: true,
          brand: { select: BRAND_SELECT },
          challenges: {
            where: { type: { in: ["FLASH_SALE", "MIX"] }, status: "ACTIVE", startDate: { lte: now }, endDate: { gt: now } },
            select: { name: true, config: true, discountBoostActive: true, startDate: true, endDate: true },
            orderBy: { startDate: "asc" },
          },
        },
      },
    },
    orderBy: [{ storefrontOrder: "asc" }, { joinedAt: "asc" }],
  });

  const creatorInfo = {
    displayName: creator.displayName,
    storefrontSlug: creator.storefrontSlug,
    vitrinaUrl: await creatorVitrinaUrl(creator.storefrontSlug),
  };

  // Una marca puede tener más de una oferta con la creadora (cada una con
  // su código): se queda la que le da más descuento a la compradora, y a
  // igual descuento la primera según el orden de su vitrina.
  type BrandRow = (typeof enrollments)[number]["offer"]["brand"];
  const byBrand = new Map<string, { info: Omit<CatalogBrand, "productCount">; brand: BrandRow }>();
  for (const enrollment of enrollments) {
    const { brand } = enrollment.offer;
    const campaign = activeCampaign(enrollment.offer.challenges);
    const discountPercent =
      campaign?.discountPercent ?? Number(enrollment.discountPercentOverride ?? enrollment.offer.defaultDiscountPercent);
    const current = byBrand.get(brand.id);
    if (current && current.info.discountPercent >= discountPercent) continue;
    const nativeStore = publicStoreUrl(brand);
    byBrand.set(brand.id, {
      brand,
      info: {
        id: brand.id,
        name: brand.companyName,
        logoUrl: absoluteUrl(brand.logoUrl),
        description: brand.description,
        city: brand.city,
        instagramHandle: brand.instagramHandle,
        tiktokHandle: brand.tiktokHandle,
        storeUrl: buildBrandStoreLink(brand, enrollment.discountCode),
        storeKind: nativeStore ? "MARCOLINI" : brand.storeType,
        codeAppliedByLink: Boolean(nativeStore) || (brand.storeType === "SHOPIFY" && Boolean(brand.storeUrl)),
        discountCode: enrollment.discountCode,
        discountPercent,
        commissionPercent:
          campaign?.commissionPercent ?? Number(enrollment.commissionPercentOverride ?? enrollment.offer.defaultCommissionPercent),
        campaign,
        visibleInVitrina: enrollment.storefrontVisible,
        vitrinaOrder: enrollment.storefrontOrder,
        joinedAt: enrollment.joinedAt.toISOString(),
      },
    });
  }

  const brandIds = [...byBrand.keys()];
  if (brandIds.length === 0) {
    return { version: CATALOG_API_VERSION, generatedAt: now.toISOString(), creator: creatorInfo, brands: [], products: [], nextCursor: null };
  }

  // Lo mismo que ve una compradora en la tienda: activo (ni borrador ni
  // "solo con link") y con stock (ver IN_STOCK_WHERE).
  const productWhere: Prisma.ProductWhereInput = {
    brandId: { in: brandIds },
    available: true,
    status: "ACTIVE",
    ...IN_STOCK_WHERE,
  };

  const [counts, rows] = await Promise.all([
    prisma.product.groupBy({ by: ["brandId"], where: productWhere, _count: { _all: true } }),
    prisma.product.findMany({
      // Paginación por id (cuid, ordenable): un producto que se agota entre
      // una página y otra no corre a los demás.
      where: options.cursor ? { AND: [productWhere, { id: { gt: options.cursor } }] } : productWhere,
      orderBy: { id: "asc" },
      take: limit + 1,
      select: {
        id: true,
        brandId: true,
        name: true,
        imageUrl: true,
        price: true,
        compareAtPrice: true,
        currency: true,
        url: true,
        slug: true,
        manual: true,
        category: true,
        type: true,
        featured: true,
        hasVariants: true,
        createdAt: true,
        updatedAt: true,
        images: { select: { url: true }, orderBy: { position: "asc" }, take: 5 },
        variants: { select: { price: true, stock: true } },
        brandCollections: { select: { collection: { select: { name: true } } } },
      },
    }),
  ]);

  const countByBrand = new Map(counts.map((c) => [c.brandId, c._count._all]));
  const page = rows.slice(0, limit);

  const products: CatalogProduct[] = page.map((product) => {
    const { brand, info } = byBrand.get(product.brandId)!;
    const { min, max } = priceSpan(product);
    const compareAt = product.compareAtPrice == null ? null : Number(product.compareAtPrice);
    const imageUrl = absoluteUrl(product.imageUrl);
    const gallery = product.images.map((i) => absoluteUrl(i.url)).filter((u): u is string => Boolean(u));
    return {
      id: product.id,
      brandId: product.brandId,
      name: product.name,
      imageUrl: imageUrl ?? gallery[0] ?? null,
      images: gallery.length > 0 ? gallery : imageUrl ? [imageUrl] : [],
      price: min,
      priceMax: max > min ? max : null,
      compareAtPrice: compareAt != null && compareAt > min ? compareAt : null,
      currency: product.currency,
      url: absoluteUrl(buildProductLink(brand, product, info.discountCode))!,
      category: product.category,
      collections: [...new Set(product.brandCollections.map((c) => c.collection.name))],
      type: product.type,
      featured: product.featured,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  });

  return {
    version: CATALOG_API_VERSION,
    generatedAt: now.toISOString(),
    creator: creatorInfo,
    brands: [...byBrand.values()].map(({ info }) => ({ ...info, productCount: countByBrand.get(info.id) ?? 0 })),
    products,
    nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
  };
}
