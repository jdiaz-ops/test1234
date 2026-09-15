import { z } from "zod";
import { TRUST_ICON_OPTIONS } from "@/lib/brand-theme";

/// Secciones de la página de inicio de la vitrina, al estilo Tiendanube
/// — la marca prende/apaga, reordena, y llena el contenido de secciones
/// ya diseñadas (no arma layouts libres bloque por bloque). Ver
/// StorefrontSection en el schema y la conversación del 2026-09-14
/// pidiendo "lo que ofrece Tiendanube" — el catálogo se amplió ese mismo
/// día tras recorrer el editor de Tiendanube módulo por módulo.
///
/// El shape de `config` por tipo vive acá (no en el schema, que solo
/// guarda un Json) — un solo lugar para validar tanto al guardar como al
/// leer para renderizar.

export const SECTION_TYPES = [
  "BANNER",
  "FEATURED_COLLECTION",
  "TEXT",
  "IMAGE_CAROUSEL",
  "SHIPPING_INFO_BANNERS",
  "CATEGORY_BANNERS",
  "CATEGORY_GRID",
  "PROMO_BANNERS",
  "FEATURED_PRODUCTS",
  "NEW_PRODUCTS",
  "ON_SALE_PRODUCTS",
  "BRAND_CAROUSEL",
  "VIDEO",
  "INSTAGRAM_CTA",
  "PRODUCT_CATALOG",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  BANNER: "Banner",
  FEATURED_COLLECTION: "Colección destacada",
  TEXT: "Texto",
  IMAGE_CAROUSEL: "Carrusel de imágenes",
  SHIPPING_INFO_BANNERS: "Información de envíos, pagos y compra",
  CATEGORY_BANNERS: "Banners de categorías",
  CATEGORY_GRID: "Selector de categorías",
  PROMO_BANNERS: "Banners promocionales",
  FEATURED_PRODUCTS: "Productos destacados",
  NEW_PRODUCTS: "Productos nuevos",
  ON_SALE_PRODUCTS: "Productos en oferta",
  BRAND_CAROUSEL: "Carrusel de logos",
  VIDEO: "Video",
  INSTAGRAM_CTA: "Síguenos en Instagram",
  PRODUCT_CATALOG: "Catálogo de productos",
};

export const SECTION_TYPE_DESCRIPTION: Record<SectionType, string> = {
  BANNER: "Una o varias imágenes de ancho completo (armá un carrusel), horizontal o cuadrado, cada una con su propio link, más título/texto/botón opcionales — el hero de tu tienda (podés agregar varios).",
  FEATURED_COLLECTION: "Muestra los productos de una de tus colecciones en una cuadrícula.",
  TEXT: "Un título y un párrafo — para un mensaje de bienvenida, institucional, o contar algo de tu marca (podés agregar varios).",
  IMAGE_CAROUSEL: "Una o más imágenes de ancho completo, sin texto — el hero clásico de tienda.",
  SHIPPING_INFO_BANNERS: "Hasta 4 sellos con ícono, título y descripción — envíos, pagos, seguridad, cambios y devoluciones.",
  CATEGORY_BANNERS: "Hasta 3 banners, cada uno enlazado a una de tus colecciones.",
  CATEGORY_GRID: "Hasta 6 categorías en cuadrícula, cada una enlazada a una de tus colecciones — para \"comprar por categoría\".",
  PROMO_BANNERS: "Hasta 3 banners promocionales sueltos, cada uno con su propio link.",
  FEATURED_PRODUCTS: "Elige a mano qué productos destacar, en grilla o carrusel.",
  NEW_PRODUCTS: "Tus productos más recientes, en grilla o carrusel — se arma solo.",
  ON_SALE_PRODUCTS: "Productos con descuento activo, en grilla o carrusel — se arma solo.",
  BRAND_CAROUSEL: "Tira de logos o imágenes chicas — marcas asociadas, sellos, \"como se vio en\".",
  VIDEO: "Un video de YouTube o Vimeo embebido, con título opcional.",
  INSTAGRAM_CTA: "Banner simple invitando a seguir tu cuenta de Instagram.",
  PRODUCT_CATALOG: "Todos tus productos activos, en la plantilla que elegiste — se arma solo.",
};

/// Cada slide es su propia imagen con su propio link — click en la
/// imagen lleva ahí (independiente del botón de abajo, que es un CTA
/// aparte superpuesto a todo el carrusel). Ver conversación del
/// 2026-09-15: "puede tener la opción de subir varias imágenes y hacer
/// un carrusel y cada imagen se puede hacer clic para llevar a una URL."
const bannerSlideSchema = z.object({
  imageUrl: z.string().min(1),
  link: z.string().max(300).default(""),
});
export type BannerSlide = z.infer<typeof bannerSlideSchema>;

const bannerConfigSchema = z.object({
  /// "horizontal" = el banner de siempre (ancho, tipo hero). "square" =
  /// 1:1, para fotos de producto/lookbook que no estiran bien en ancho
  /// completo. Ver conversación del 2026-09-15.
  aspectRatio: z.enum(["horizontal", "square"]).default("horizontal"),
  slides: z.array(bannerSlideSchema).max(6).default([]),
  title: z.string().max(120).default(""),
  subtitle: z.string().max(240).default(""),
  buttonText: z.string().max(40).default(""),
  buttonLink: z.string().max(300).default(""),
});
export type BannerConfig = z.infer<typeof bannerConfigSchema>;

/// Normaliza un config de BANNER tal como llega crudo de la base (nunca
/// se revalida contra el schema al leer — solo al guardar, ver
/// parseSectionConfig) al shape nuevo con `slides`. Antes del carrusel
/// del 2026-09-15, `config.imageUrl` era un string suelto; sin este
/// resguardo, una sección vieja tira "Cannot read properties of
/// undefined (reading 'filter')" y tumba la página entera — le pasó a
/// una vitrina real (hlc.marcolini.lat) porque el script de backfill de
/// esa migración corrió contra la base de desarrollo, nunca contra la
/// de producción. Se usa tanto en la vitrina pública como en el editor
/// del portal, así no depende de que ningún script haya corrido.
export function normalizeBannerConfig(raw: unknown): BannerConfig {
  const config = (raw ?? {}) as Partial<BannerConfig> & { imageUrl?: string | null };
  if (Array.isArray(config.slides)) return config as BannerConfig;
  return {
    aspectRatio: config.aspectRatio ?? "horizontal",
    slides: config.imageUrl ? [{ imageUrl: config.imageUrl, link: "" }] : [],
    title: config.title ?? "",
    subtitle: config.subtitle ?? "",
    buttonText: config.buttonText ?? "",
    buttonLink: config.buttonLink ?? "",
  };
}

const featuredCollectionConfigSchema = z.object({
  collectionId: z.string().nullable().default(null),
  title: z.string().max(120).default(""),
});
export type FeaturedCollectionConfig = z.infer<typeof featuredCollectionConfigSchema>;

const textConfigSchema = z.object({
  heading: z.string().max(120).default(""),
  body: z.string().max(2000).default(""),
});
export type TextConfig = z.infer<typeof textConfigSchema>;

const imageCarouselConfigSchema = z.object({
  images: z.array(z.string().min(1)).max(8).default([]),
});
export type ImageCarouselConfig = z.infer<typeof imageCarouselConfigSchema>;

const TRUST_ICON_VALUES = TRUST_ICON_OPTIONS.map((i) => i.value) as [string, ...string[]];
const shippingInfoItemSchema = z.object({
  show: z.boolean().default(false),
  icon: z.enum(TRUST_ICON_VALUES).default("NONE"),
  imageUrl: z.string().nullable().default(null),
  title: z.string().max(60).default(""),
  description: z.string().max(120).default(""),
  link: z.string().max(300).default(""),
});
const shippingInfoBannersConfigSchema = z.object({
  items: z
    .array(shippingInfoItemSchema)
    .length(4)
    .default(() => Array.from({ length: 4 }, () => shippingInfoItemSchema.parse({}))),
});
export type ShippingInfoBannersConfig = z.infer<typeof shippingInfoBannersConfigSchema>;

const categoryBannerItemSchema = z.object({
  show: z.boolean().default(false),
  collectionId: z.string().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
});
const categoryBannersConfigSchema = z.object({
  extendFullWidth: z.boolean().default(false),
  items: z
    .array(categoryBannerItemSchema)
    .length(3)
    .default(() => Array.from({ length: 3 }, () => categoryBannerItemSchema.parse({}))),
});
export type CategoryBannersConfig = z.infer<typeof categoryBannersConfigSchema>;

/// "Selector de categorías" — cuadrícula compacta (ícono/foto + nombre),
/// hasta 6, distinta de CATEGORY_BANNERS (hasta 3, formato banner grande
/// con texto superpuesto). Pedido explícito de la marca para armar algo
/// tipo "comprar por categoría" con varias categorías a la vez — ver
/// conversación del 2026-09-14.
const categoryGridItemSchema = z.object({
  show: z.boolean().default(false),
  collectionId: z.string().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  /// Vacío = usa el nombre de la colección tal cual.
  label: z.string().max(40).default(""),
});
const categoryGridConfigSchema = z.object({
  /// Título/bajada opcionales arriba de la cuadrícula — ej. "Compra por
  /// categoría". Ver conversación del 2026-09-15.
  title: z.string().max(120).default(""),
  subtitle: z.string().max(240).default(""),
  items: z
    .array(categoryGridItemSchema)
    .length(6)
    .default(() => Array.from({ length: 6 }, () => categoryGridItemSchema.parse({}))),
});
export type CategoryGridConfig = z.infer<typeof categoryGridConfigSchema>;

const promoBannerItemSchema = z.object({
  show: z.boolean().default(false),
  imageUrl: z.string().nullable().default(null),
  link: z.string().max(300).default(""),
});
const promoBannersConfigSchema = z.object({
  extendFullWidth: z.boolean().default(false),
  items: z
    .array(promoBannerItemSchema)
    .length(3)
    .default(() => Array.from({ length: 3 }, () => promoBannerItemSchema.parse({}))),
});
export type PromoBannersConfig = z.infer<typeof promoBannersConfigSchema>;

const productGroupDisplaySchema = z.enum(["grid", "carousel"]);

const featuredProductsConfigSchema = z.object({
  title: z.string().max(80).default("Destacados"),
  display: productGroupDisplaySchema.default("carousel"),
  productIds: z.array(z.string()).max(24).default([]),
});
export type FeaturedProductsConfig = z.infer<typeof featuredProductsConfigSchema>;

const newProductsConfigSchema = z.object({
  title: z.string().max(80).default("Novedades"),
  display: productGroupDisplaySchema.default("carousel"),
});
export type NewProductsConfig = z.infer<typeof newProductsConfigSchema>;

const onSaleProductsConfigSchema = z.object({
  title: z.string().max(80).default("Ofertas"),
  display: productGroupDisplaySchema.default("carousel"),
});
export type OnSaleProductsConfig = z.infer<typeof onSaleProductsConfigSchema>;

const brandCarouselItemSchema = z.object({
  imageUrl: z.string().min(1),
  link: z.string().max(300).optional().or(z.literal("")),
});
const brandCarouselConfigSchema = z.object({
  items: z.array(brandCarouselItemSchema).max(12).default([]),
});
export type BrandCarouselConfig = z.infer<typeof brandCarouselConfigSchema>;

const videoConfigSchema = z.object({
  url: z.string().max(300).default(""),
  title: z.string().max(120).default(""),
});
export type VideoConfig = z.infer<typeof videoConfigSchema>;

const instagramCtaConfigSchema = z.object({
  title: z.string().max(80).default("Síguenos en Instagram"),
  description: z.string().max(160).default(""),
});
export type InstagramCtaConfig = z.infer<typeof instagramCtaConfigSchema>;

/// Todo el catálogo activo, en la plantilla elegida (Clásica/Minimal/
/// Editorial) — antes vivía fijo en la página de inicio, ahora es una
/// sección más que se agrega/quita/reordena como cualquier otra. Ver
/// conversación del 2026-09-15: "Quita todo eso. Que el único sitio para
/// poner o quitar elementos de la homepage sea desde diseño, página
/// inicio."
const productCatalogConfigSchema = z.object({
  title: z.string().max(120).default(""),
});
export type ProductCatalogConfig = z.infer<typeof productCatalogConfigSchema>;

export const SECTION_CONFIG_SCHEMA: Record<SectionType, z.ZodTypeAny> = {
  BANNER: bannerConfigSchema,
  FEATURED_COLLECTION: featuredCollectionConfigSchema,
  TEXT: textConfigSchema,
  IMAGE_CAROUSEL: imageCarouselConfigSchema,
  SHIPPING_INFO_BANNERS: shippingInfoBannersConfigSchema,
  CATEGORY_BANNERS: categoryBannersConfigSchema,
  CATEGORY_GRID: categoryGridConfigSchema,
  PROMO_BANNERS: promoBannersConfigSchema,
  FEATURED_PRODUCTS: featuredProductsConfigSchema,
  NEW_PRODUCTS: newProductsConfigSchema,
  ON_SALE_PRODUCTS: onSaleProductsConfigSchema,
  BRAND_CAROUSEL: brandCarouselConfigSchema,
  VIDEO: videoConfigSchema,
  INSTAGRAM_CTA: instagramCtaConfigSchema,
  PRODUCT_CATALOG: productCatalogConfigSchema,
};

export const DEFAULT_SECTION_CONFIG: Record<SectionType, unknown> = Object.fromEntries(
  SECTION_TYPES.map((t) => [t, SECTION_CONFIG_SCHEMA[t].parse({})]),
) as Record<SectionType, unknown>;

/// Valida/normaliza el config de una sección según su tipo — tira si no
/// calza con el schema de ese tipo. Se usa al crear/editar (nunca se
/// confía en el JSON tal como llega del cliente).
export function parseSectionConfig(type: SectionType, raw: unknown) {
  return SECTION_CONFIG_SCHEMA[type].parse(raw ?? {});
}
