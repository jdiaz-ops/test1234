import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBrandStoreLink, buildProductLink } from "@/lib/brand-store-link";
import { creatorVitrinaUrl } from "@/lib/creator-identity";
import { COLOR_FAMILY_ATTRIBUTE, isColorFamily } from "@/lib/color-families";
import { GROUP_ATTRIBUTE, readProductAttributes } from "@/lib/product-attributes";
import { detectProductFamilies, SIZE_AXES } from "@/lib/product-families";
import { splitLineName } from "@/lib/product-lines";
import { IN_STOCK_WHERE } from "@/lib/product-stock";
import { stripHtml } from "@/lib/sanitize-html";
import { nicheCategoryOf } from "@/lib/shopify-categorize";
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
/// Ventana de "lo más vendido con el código de la creadora".
export const SOLD_WINDOW_DAYS = 90;
const DESCRIPTION_MAX = 300;
/// Atributos que nombran la variante de un producto separado ("Tono":
/// "Princesa"), en orden de preferencia.
const VARIANT_ATTRIBUTES = ["Tono", "Color", "Aroma", "Sabor", "Diseño", "Modelo"];

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
  /// Envío gratis desde este subtotal (COP), según las zonas de envío de su
  /// tienda en Marcolini; 0 = siempre gratis; null = no ofrece o no se sabe
  /// (tiendas Shopify/WooCommerce). freeShippingAllZones = vale para todas
  /// sus zonas (si no, solo en algunas, desde el menor de los montos).
  freeShippingFrom: number | null;
  freeShippingAllZones: boolean;
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
  /// Texto plano, corto — para buscar ("libre de HEMA", "vegano").
  description: string | null;
  /// Atributos tal cual: { "Familia de color": "Nudes", Tono, Tamaño, Grupo… }.
  attributes: Record<string, string>;
  /// Una de las familias de color fijas de Marcolini (la pone la IA mirando
  /// la foto), o null.
  colorFamily: string | null;
  /// La categoría del nicho con las mismas reglas con que Marcolini propone
  /// colecciones (nicheCategoryOf): "Esmaltes", "Gel de construcción"…
  nicheCategory: string | null;
  /// La línea a la que pertenece ("Gel Polish Rosados") y qué es dentro de
  /// ella ("Princesa"): del atributo Grupo, de la familia que se detecta por
  /// el nombre, o de "Línea – Referencia". null si va solo.
  line: string | null;
  variant: string | null;
  size: string | null;
  /// Cuando el producto mismo tiene variantes (un esmalte con 12 tonos).
  variantCount: number;
  optionNames: string[];
  /// Reseñas aprobadas.
  rating: { average: number; count: number } | null;
  /// Unidades que le quedan, solo si la tienda controla inventario.
  unitsLeft: number | null;
  /// Unidades vendidas con el código de la creadora en los últimos
  /// SOLD_WINDOW_DAYS días (pedidos pagados en la tienda de Marcolini).
  soldWithCode: number;
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

/// Unidades que quedan, solo cuando se controla inventario: sin variantes,
/// su stock; con variantes, la suma — salvo que alguna se venda sin límite.
function unitsLeft(product: { hasVariants: boolean; stock: number | null; variants: { stock: number | null }[] }): number | null {
  if (!product.hasVariants || product.variants.length === 0) return product.stock == null ? null : Math.max(0, product.stock);
  if (product.variants.some((v) => v.stock == null)) return null;
  return product.variants.reduce((sum, v) => sum + Math.max(0, v.stock ?? 0), 0);
}

type ShippingRate = { price: Prisma.Decimal; pendingPrice: boolean; condition: string; conditionValue: Prisma.Decimal | null };

/// Desde qué subtotal una zona envía gratis: una tarifa en $0 sin condición
/// (siempre) o con "pedido mínimo"; null si no tiene ninguna gratis.
function zoneFreeFrom(rates: ShippingRate[]): number | null {
  const free = rates
    .filter((r) => !r.pendingPrice && Number(r.price) === 0)
    .map((r) => (r.condition === "NONE" ? 0 : r.condition === "MIN_ORDER_AMOUNT" && r.conditionValue != null ? Number(r.conditionValue) : null))
    .filter((v): v is number => v != null);
  return free.length > 0 ? Math.min(...free) : null;
}

/// Lo que no sale de la fila del producto: su familia (línea, variante,
/// tamaño), reseñas, ventas con el código de la creadora y el envío gratis
/// de cada marca. Las familias se arman con TODOS los productos de cada
/// marca (no solo la página), igual que en la página de producto.
async function catalogExtras(input: {
  pageIds: string[];
  productWhere: Prisma.ProductWhereInput;
  brands: { brand: { id: string; storefrontSlug: string | null; customDomain: string | null; customDomainActiveAt: Date | null }; code: string }[];
  now: Date;
}) {
  const since = new Date(input.now.getTime() - SOLD_WINDOW_DAYS * 86_400_000);
  const nativeBrandIds = input.brands.filter((b) => publicStoreUrl(b.brand)).map((b) => b.brand.id);
  const [names, ratings, sold, zones] = await Promise.all([
    prisma.product.findMany({ where: input.productWhere, select: { id: true, brandId: true, name: true } }),
    input.pageIds.length === 0
      ? Promise.resolve([])
      : prisma.productReview.groupBy({
          by: ["productId"],
          where: { productId: { in: input.pageIds }, status: "APPROVED" },
          _avg: { rating: true },
          _count: { _all: true },
        }),
    input.pageIds.length === 0
      ? Promise.resolve([])
      : prisma.storeOrderItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: input.pageIds },
            order: {
              status: "PAID",
              kind: "PURCHASE",
              paidAt: { gte: since },
              OR: input.brands.map((b) => ({ brandId: b.brand.id, discountCode: { equals: b.code, mode: "insensitive" as const } })),
            },
          },
          _sum: { quantity: true },
        }),
    nativeBrandIds.length === 0
      ? Promise.resolve([])
      : prisma.shippingZone.findMany({
          where: { brandId: { in: nativeBrandIds } },
          select: { brandId: true, rates: { select: { price: true, pendingPrice: true, condition: true, conditionValue: true } } },
        }),
  ]);

  const familyByProduct = new Map<string, { group: string; variant: string | null; size: string | null }>();
  const namesByBrand = new Map<string, { id: string; name: string }[]>();
  for (const n of names) namesByBrand.set(n.brandId, [...(namesByBrand.get(n.brandId) ?? []), { id: n.id, name: n.name }]);
  for (const list of namesByBrand.values()) {
    for (const family of detectProductFamilies(list)) {
      for (const member of family.members) {
        const sizeAxis = family.axes.find((a) => SIZE_AXES.has(a));
        const variantAxis = family.axes.find((a) => !SIZE_AXES.has(a));
        familyByProduct.set(member.id, {
          group: family.group,
          variant: variantAxis ? member.attrs[variantAxis] ?? null : null,
          size: sizeAxis ? member.attrs[sizeAxis] ?? null : null,
        });
      }
    }
  }

  const ratingByProduct = new Map(
    ratings.map((r) => [r.productId, { average: r._avg.rating ?? 0, count: r._count._all }] as const),
  );
  const soldByProduct = new Map(
    sold.filter((s) => s.productId).map((s) => [s.productId!, s._sum.quantity ?? 0] as const),
  );

  const shippingByBrand = new Map<string, { from: number; allZones: boolean }>();
  const zonesByBrand = new Map<string, (number | null)[]>();
  for (const zone of zones) zonesByBrand.set(zone.brandId, [...(zonesByBrand.get(zone.brandId) ?? []), zoneFreeFrom(zone.rates)]);
  for (const [brandId, values] of zonesByBrand) {
    const free = values.filter((v): v is number => v != null);
    if (free.length === 0) continue;
    const allZones = free.length === values.length;
    // En todas: el monto que vale en todas (el mayor); si no, el menor.
    shippingByBrand.set(brandId, { from: allZones ? Math.max(...free) : Math.min(...free), allZones });
  }

  return { familyByProduct, ratingByProduct, soldByProduct, shippingByBrand };
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
        freeShippingFrom: null,
        freeShippingAllZones: false,
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
        optionNames: true,
        stock: true,
        description: true,
        attributes: true,
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
  const pageIds = page.map((p) => p.id);
  const extras = await catalogExtras({
    pageIds,
    productWhere,
    brands: [...byBrand.values()].map(({ brand, info }) => ({ brand, code: info.discountCode })),
    now,
  });
  for (const { info } of byBrand.values()) {
    const shipping = extras.shippingByBrand.get(info.id);
    if (shipping) {
      info.freeShippingFrom = shipping.from;
      info.freeShippingAllZones = shipping.allZones;
    }
  }

  const products: CatalogProduct[] = page.map((product) => {
    const { brand, info } = byBrand.get(product.brandId)!;
    const { min, max } = priceSpan(product);
    const compareAt = product.compareAtPrice == null ? null : Number(product.compareAtPrice);
    const imageUrl = absoluteUrl(product.imageUrl);
    const gallery = product.images.map((i) => absoluteUrl(i.url)).filter((u): u is string => Boolean(u));
    const collections = [...new Set(product.brandCollections.map((c) => c.collection.name))];
    const attributes = readProductAttributes(product.attributes);
    const family = extras.familyByProduct.get(product.id);
    const lineFromName = splitLineName(product.name);
    const colorFamily = attributes[COLOR_FAMILY_ATTRIBUTE];
    const rating = extras.ratingByProduct.get(product.id);
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
      collections,
      type: product.type,
      featured: product.featured,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      // Sin el espacio que deja cada etiqueta antes de la puntuación ("HEMA , vegano").
      description: product.description ? stripHtml(product.description, DESCRIPTION_MAX).replace(/\s+([,.;:!?)])/g, "$1") || null : null,
      attributes,
      colorFamily: colorFamily && isColorFamily(colorFamily) ? colorFamily : null,
      nicheCategory:
        nicheCategoryOf(product.name) ?? (collections.length > 0 ? nicheCategoryOf(collections.join(" ")) : null) ?? (product.category ? nicheCategoryOf(product.category) : null),
      line: attributes[GROUP_ATTRIBUTE] ?? family?.group ?? lineFromName?.line ?? null,
      variant: VARIANT_ATTRIBUTES.map((a) => attributes[a]).find(Boolean) ?? family?.variant ?? lineFromName?.rest ?? null,
      size: attributes["Tamaño"] ?? family?.size ?? null,
      variantCount: product.hasVariants ? product.variants.length : 0,
      optionNames: product.hasVariants ? product.optionNames : [],
      rating: rating ? { average: Math.round(rating.average * 10) / 10, count: rating.count } : null,
      unitsLeft: unitsLeft(product),
      soldWithCode: extras.soldByProduct.get(product.id) ?? 0,
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
