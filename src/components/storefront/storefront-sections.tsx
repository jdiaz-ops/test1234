import { cardProductSelect } from "@/lib/card-product-select";
import Link from "next/link";
import { StoreImage } from "@/components/storefront/store-image";
import type {
  BannerConfig,
  BannerSlide,
  FeaturedCollectionConfig,
  TextConfig,
  ImageCarouselConfig,
  ShippingInfoBannersConfig,
  CategoryBannersConfig,
  CategoryGridConfig,
  PromoBannersConfig,
  FeaturedProductsConfig,
  NewProductsConfig,
  OnSaleProductsConfig,
  BrandCarouselConfig,
  VideoConfig,
  InstagramCtaConfig,
  ProductCatalogConfig,
  CustomBlockConfig,
  CustomBlockItem,
} from "@/lib/storefront-sections";
import { normalizeBannerConfig } from "@/lib/storefront-sections";
import { contrastTextFor, TRUST_ICON_OPTIONS } from "@/lib/brand-theme";
import { getBrandCollection, sortCollectionProducts } from "@/server/services/brand-collection-service";
import { listStorefrontProducts } from "@/server/services/store-order-service";
import { isSoldOut, stockWhere } from "@/lib/product-stock";
import { CatalogTemplate } from "@/components/storefront/catalog-templates";
import { ProductCard, toCardProduct, type CardProduct } from "@/components/storefront/product-card";
import { prisma } from "@/lib/prisma";


/// Espacio arriba y abajo de cada sección, el de Diseño → Página de inicio
/// → "Espacio entre secciones" (variables del layout, ver themeToCssVars).
const SECTION_PAD = "py-[var(--section-pad-y,16px)] sm:py-[var(--section-pad-y-lg,26px)]";

function trustIconEmoji(icon: string) {
  return TRUST_ICON_OPTIONS.find((i) => i.value === icon)?.emoji ?? null;
}

function resolveLink(link: string, basePath: string) {
  if (!link) return null;
  if (link.startsWith("http")) return link;
  if (link.startsWith("/")) return `${basePath}${link}`;
  return `${basePath}/${link}`;
}

/// Una imagen de slide, clickeable a su propio link si lo tiene —
/// `wrapperClassName` trae el tamaño/posicionamiento (distinto si es la
/// única imagen vs. si va dentro del carrusel). Ver conversación del
/// 2026-09-15.
function BannerSlideImage({
  slide,
  basePath,
  wrapperClassName,
  fit,
}: {
  slide: BannerSlide;
  basePath: string;
  wrapperClassName: string;
  /// true = la imagen manda el alto (entera, sin recortar); false = llena
  /// el marco de proporción fija y recorta lo que sobre.
  fit: boolean;
}) {
  // Banner: ancho completo, primera foto de la página — se carga ya y en
  // el tamaño de la pantalla (ver StoreImage).
  const mobile = slide.mobileImageUrl || "";
  const img = mobile ? (
    // Con versión para celular (los banners pintados por /api/banner, ver
    // banner-image.ts): <picture> baja solo la que corresponde a la
    // pantalla. Son direcciones propias, sin optimizador.
    <picture className={fit ? "block w-full" : "absolute inset-0 block"}>
      <source media="(min-width: 768px)" srcSet={slide.imageUrl} />
      <img src={mobile} alt="" className={fit ? "w-full h-auto block" : "absolute inset-0 w-full h-full object-cover"} loading="eager" />
    </picture>
  ) : fit ? (
    <StoreImage src={slide.imageUrl} alt="" natural sizes="100vw" priority />
  ) : (
    <StoreImage src={slide.imageUrl} alt="" className="object-cover" sizes="100vw" priority />
  );
  const href = resolveLink(slide.link, basePath);
  return href ? (
    <Link href={href} className={wrapperClassName}>
      {img}
    </Link>
  ) : (
    <div className={wrapperClassName}>{img}</div>
  );
}

function BannerSection({ config: rawConfig, basePath }: { config: BannerConfig; basePath: string }) {
  const config = normalizeBannerConfig(rawConfig);
  const slides = config.slides.filter((s) => s.imageUrl);
  if (slides.length === 0 && !config.title) return null;
  // Con "original" no hay marco de proporción fija: la imagen entera
  // define el alto del banner (sin recortar). Ver conversación del
  // 2026-09-30: "el banner debe fit".
  const fit = config.aspectRatio === "original";
  const aspectClass =
    config.aspectRatio === "square"
      ? "aspect-square"
      : config.aspectRatio === "horizontal"
        ? "aspect-[21/9] sm:aspect-[3/1]"
        : "";
  return (
    <div className={`relative w-full ${aspectClass} overflow-hidden bg-brand-accent-soft`}>
      {slides.length === 1 && (
        <BannerSlideImage
          slide={slides[0]}
          basePath={basePath}
          fit={fit}
          wrapperClassName={fit ? "block w-full" : "absolute inset-0 block"}
        />
      )}
      {/* Más de una imagen = carrusel deslizable (scroll-snap, sin JS) —
          cada imagen ocupa el ancho completo y arrastra a su propio
          link. Ver conversación del 2026-09-15. */}
      {slides.length > 1 && (
        <div className={`flex overflow-x-auto snap-x snap-mandatory ${fit ? "" : "absolute inset-0"}`}>
          {slides.map((s, i) => (
            <BannerSlideImage
              key={i}
              slide={s}
              basePath={basePath}
              fit={fit}
              wrapperClassName={`w-full shrink-0 snap-center block ${fit ? "" : "relative h-full"}`}
            />
          ))}
        </div>
      )}
      {(config.title || config.subtitle || config.buttonText) && (
        <div className="absolute inset-0 bg-black/25 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
          {config.title && (
            <h2 className="font-display text-2xl sm:text-4xl font-semibold text-white drop-shadow">
              {config.title}
            </h2>
          )}
          {config.subtitle && (
            <p className="text-sm sm:text-base text-white/90 mt-2 max-w-lg drop-shadow">
              {config.subtitle}
            </p>
          )}
          {config.buttonText && config.buttonLink && (
            <Link
              href={resolveLink(config.buttonLink, basePath) ?? basePath}
              className="mt-4 bg-white text-brand-ink text-sm font-medium rounded-full px-6 py-2.5 hover:opacity-90 pointer-events-auto"
            >
              {config.buttonText}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

async function FeaturedCollectionSection({
  config,
  brandId,
  basePath,
  showSoldOut = false,
}: {
  config: FeaturedCollectionConfig;
  brandId: string;
  basePath: string;
  showSoldOut?: boolean;
}) {
  if (!config.collectionId) return null;
  const collection = await getBrandCollection(brandId, config.collectionId);
  if (!collection) return null;
  const products = sortCollectionProducts(collection.products, collection.sortOrder)
    .map((p) => p.product)
    .filter((p) => p.status === "ACTIVE" && p.available && (showSoldOut || !isSoldOut(p)))
    .slice(0, 12);
  if (products.length === 0) return null;

  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <h2 className="font-display text-xl font-semibold text-brand-ink">
          {config.title || collection.name}
        </h2>
        <Link
          href={`${basePath}/coleccion/${collection.slug}`}
          className="text-xs font-medium text-brand-accent hover:underline shrink-0 whitespace-nowrap"
        >
          Ver más →
        </Link>
      </div>
      {/* Carrusel deslizable con tarjetas grandes (imagen + título +
          precio + agregar al carrito) en vez de la grilla chica de
          antes — pedido explícito: "que las secciones de colecciones
          [...] sea deslizable y así de grandes y presentados. Con un
          link de ver más que lleva hacia la colección." Ver
          conversación del 2026-09-15. */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto snap-x pb-1">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={toCardProduct(p)}
            basePath={basePath}
            className="w-44 sm:w-60 lg:w-72 shrink-0 snap-start"
          />
        ))}
      </div>
    </div>
  );
}

/// `asHeading`: un título solo (sin párrafo) seguido de otra sección es el
/// título de esa sección ("Compra por categoría" sobre la cuadrícula): va
/// sin espacio abajo, pegado a lo que titula.
function TextSection({ config, asHeading = false }: { config: TextConfig; asHeading?: boolean }) {
  if (!config.heading && !config.body) return null;
  const titleOnly = asHeading && !config.body;
  return (
    <div
      className={`max-w-[1600px] mx-auto px-4 sm:px-8 text-center ${
        titleOnly ? "pt-[var(--section-pad-y,16px)] sm:pt-[var(--section-pad-y-lg,26px)]" : SECTION_PAD
      }`}
    >
      {config.heading && (
        <h2 className={`font-display text-xl font-semibold text-brand-ink ${titleOnly ? "" : "mb-2"}`}>
          {config.heading}
        </h2>
      )}
      {config.body && (
        <p className="text-sm text-brand-ink-soft whitespace-pre-line max-w-lg mx-auto">
          {config.body}
        </p>
      )}
    </div>
  );
}

function ImageCarouselSection({ config }: { config: ImageCarouselConfig }) {
  const images = config.images.filter(Boolean);
  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] overflow-hidden bg-brand-accent-soft">
        <StoreImage src={images[0]} alt="" className="object-cover" sizes="100vw" />
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto snap-x snap-mandatory flex">
      {images.map((url, i) => (
        <div key={i} className="relative w-full shrink-0 snap-center aspect-[21/9] sm:aspect-[3/1]">
          <StoreImage src={url} alt="" className="object-cover" sizes="100vw" />
        </div>
      ))}
    </div>
  );
}

function ShippingInfoBannersSection({ config }: { config: ShippingInfoBannersConfig }) {
  // Una cajita puede ser solo una imagen (el ícono con el texto adentro,
  // como vienen de muchas tiendas WordPress): se muestra más grande.
  const items = config.items.filter((i) => i.show && (i.title || i.description || i.imageUrl));
  if (items.length === 0) return null;
  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item, i) => {
          const emoji = trustIconEmoji(item.icon);
          const imageOnly = Boolean(item.imageUrl) && !item.title && !item.description;
          const body = (
            <div className="text-center">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- icono subido por la marca
                <img
                  src={item.imageUrl}
                  alt=""
                  className={imageOnly ? "w-28 h-28 sm:w-36 sm:h-36 mx-auto object-contain" : "w-8 h-8 mx-auto mb-2 object-contain"}
                />
              ) : (
                emoji && <p className="text-2xl mb-2">{emoji}</p>
              )}
              {item.title && <p className="text-sm font-medium text-brand-ink">{item.title}</p>}
              {item.description && (
                <p className="text-xs text-brand-ink-soft mt-0.5">{item.description}</p>
              )}
            </div>
          );
          return item.link ? (
            <Link key={i} href={item.link}>
              {body}
            </Link>
          ) : (
            <div key={i}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}

async function CategoryBannersSection({
  config,
  brandId,
  basePath,
}: {
  config: CategoryBannersConfig;
  brandId: string;
  basePath: string;
}) {
  const visible = config.items.filter((i) => i.show && i.collectionId);
  if (visible.length === 0) return null;
  const collections = await prisma.brandCollection.findMany({
    where: { id: { in: visible.map((i) => i.collectionId!) }, brandId },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(collections.map((c) => [c.id, c]));
  const items = visible
    .map((i) => ({ ...i, collection: byId.get(i.collectionId!) }))
    .filter((i) => i.collection);
  if (items.length === 0) return null;

  return (
    <div className={`max-w-[1600px] mx-auto ${config.extendFullWidth ? "px-0" : "px-4 sm:px-8"} ${SECTION_PAD}`}>
      <div className={`grid gap-3 ${items.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
        {items.map((item, i) => (
          <Link
            key={i}
            href={`${basePath}/coleccion/${item.collection!.slug}`}
            className="relative aspect-[4/3] rounded-xl overflow-hidden bg-brand-accent-soft block"
          >
            {item.imageUrl && (
              <StoreImage src={item.imageUrl} alt="" className="object-cover" sizes="(min-width: 640px) 33vw, 100vw" />
            )}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <p className="font-display text-white text-lg font-semibold drop-shadow">
                {item.collection!.name}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function CategoryGridSection({
  config,
  brandId,
  basePath,
}: {
  config: CategoryGridConfig;
  brandId: string;
  basePath: string;
}) {
  const visible = config.items.filter((i) => i.show && i.collectionId);
  if (visible.length === 0) return null;
  const collections = await prisma.brandCollection.findMany({
    where: { id: { in: visible.map((i) => i.collectionId!) }, brandId },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });
  const byId = new Map(collections.map((c) => [c.id, c]));
  const items = visible
    .map((i) => ({ ...i, collection: byId.get(i.collectionId!) }))
    .filter((i) => i.collection);
  if (items.length === 0) return null;

  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      {(config.title || config.subtitle) && (
        <div className="mb-4">
          {config.title && (
            <h2 className="font-display text-xl font-semibold text-brand-ink">{config.title}</h2>
          )}
          {config.subtitle && (
            <p className="text-sm text-brand-ink-soft mt-1">{config.subtitle}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {items.map((item, i) => {
          // La foto propia del ítem manda — si la marca no subió una acá,
          // usa la de la colección (la que se subió al crearla/editarla en
          // Colecciones) como respaldo, para no repetir la misma imagen
          // dos veces. Sin ninguna de las dos, queda el círculo vacío. Ver
          // conversación del 2026-09-14.
          const imageUrl = item.imageUrl ?? item.collection!.imageUrl;
          return (
            <Link
              key={i}
              href={`${basePath}/coleccion/${item.collection!.slug}`}
              aria-label={item.label || item.collection!.name}
              className="flex flex-col items-center gap-1.5 group"
            >
              {/* Cuadrada, mismo radio que las tarjetas de producto — la
                  marca prefiere esto a un círculo tipo "historias". Ver
                  conversación del 2026-09-15. */}
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-brand-accent-soft relative flex items-center justify-center">
                {imageUrl ? (
                  <StoreImage
                    src={imageUrl}
                    alt=""
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(min-width: 640px) 160px, 30vw"
                  />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-1/3 h-1/3 text-brand-ink-soft/50">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="1.5" />
                    <path d="m3 16 5-5 4 4 3-3 6 6" />
                  </svg>
                )}
              </div>
              {config.showLabels && (
                <p className="text-[11px] text-brand-ink text-center leading-tight line-clamp-2">
                  {item.label || item.collection!.name}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PromoBannersSection({ config, basePath }: { config: PromoBannersConfig; basePath: string }) {
  const items = config.items.filter((i) => i.show && i.imageUrl);
  if (items.length === 0) return null;
  return (
    <div className={`max-w-[1600px] mx-auto ${config.extendFullWidth ? "px-0" : "px-4 sm:px-8"} ${SECTION_PAD}`}>
      <div className={`grid gap-3 ${items.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
        {items.map((item, i) => {
          const href = resolveLink(item.link, basePath);
          const img = (
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
              <StoreImage src={item.imageUrl!} alt="" className="object-cover" sizes="(min-width: 640px) 33vw, 100vw" />
            </div>
          );
          return href ? (
            <Link key={i} href={href}>
              {img}
            </Link>
          ) : (
            <div key={i}>{img}</div>
          );
        })}
      </div>
    </div>
  );
}

/// Destacados / Novedades / Ofertas — misma tarjeta que Colección
/// destacada y que el catálogo Clásico (ver ProductCard), en grilla o
/// carrusel.
function ProductGrid({
  title,
  products,
  display,
  basePath,
}: {
  title: string;
  products: CardProduct[];
  display: "grid" | "carousel";
  basePath: string;
}) {
  if (products.length === 0) return null;
  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      {title && (
        <h2 className="font-display text-xl font-semibold text-brand-ink mb-4">{title}</h2>
      )}
      <div
        className={
          display === "carousel"
            ? "flex gap-3 sm:gap-4 overflow-x-auto snap-x pb-1"
            : "grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
        }
      >
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            basePath={basePath}
            className={display === "carousel" ? "w-44 sm:w-60 lg:w-72 shrink-0 snap-start" : ""}
          />
        ))}
      </div>
    </div>
  );
}

/// Los productos elegidos a mano, en el orden en que la marca los marcó.
async function listPickedProducts(brandId: string, productIds: string[], showSoldOut = false) {
  if (productIds.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, brandId, manual: true, status: "ACTIVE", ...stockWhere({ showSoldOut }) },
    select: cardProductSelect,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return productIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(toCardProduct);
}

async function FeaturedProductsSection({
  config,
  brandId,
  basePath,
  showSoldOut = false,
}: {
  config: FeaturedProductsConfig;
  brandId: string;
  basePath: string;
  showSoldOut?: boolean;
}) {
  const products = await listPickedProducts(brandId, config.productIds, showSoldOut);
  return <ProductGrid title={config.title} products={products} display={config.display} basePath={basePath} />;
}

async function NewProductsSection({
  config,
  brandId,
  basePath,
  showSoldOut = false,
}: {
  config: NewProductsConfig;
  brandId: string;
  basePath: string;
  showSoldOut?: boolean;
}) {
  const products = await prisma.product.findMany({
    where: { brandId, manual: true, status: "ACTIVE", ...stockWhere({ showSoldOut }) },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: cardProductSelect,
  });
  return (
    <ProductGrid
      title={config.title}
      products={products.map(toCardProduct)}
      display={config.display}
      basePath={basePath}
    />
  );
}

async function OnSaleProductsSection({
  config,
  brandId,
  basePath,
  showSoldOut = false,
}: {
  config: OnSaleProductsConfig;
  brandId: string;
  basePath: string;
  showSoldOut?: boolean;
}) {
  // Secciones guardadas antes del selector de fuente no traen `source`
  // (el config no se revalida al leer) — se comportan como "auto".
  const source = config.source ?? "auto";

  if (source === "collection") {
    if (!config.collectionId) return null;
    const collection = await getBrandCollection(brandId, config.collectionId);
    if (!collection) return null;
    const products = sortCollectionProducts(collection.products, collection.sortOrder)
      .map((p) => p.product)
      .filter((p) => p.status === "ACTIVE" && p.available && (showSoldOut || !isSoldOut(p)))
      .slice(0, 24)
      .map(toCardProduct);
    return <ProductGrid title={config.title} products={products} display={config.display} basePath={basePath} />;
  }

  if (source === "manual") {
    const products = await listPickedProducts(brandId, config.productIds ?? [], showSoldOut);
    return <ProductGrid title={config.title} products={products} display={config.display} basePath={basePath} />;
  }

  // Prisma no compara dos columnas entre sí en el where — se trae un lote
  // razonable de productos activos y se filtra compareAtPrice > price en
  // memoria. Suficiente para el tamaño de catálogo de esta plataforma.
  const candidates = await prisma.product.findMany({
    where: { brandId, manual: true, status: "ACTIVE", compareAtPrice: { not: null }, ...stockWhere({ showSoldOut }) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: cardProductSelect,
  });
  const onSale = candidates
    .filter((p) => p.compareAtPrice != null && Number(p.compareAtPrice) > Number(p.price))
    .slice(0, 8)
    .map(toCardProduct);
  return <ProductGrid title={config.title} products={onSale} display={config.display} basePath={basePath} />;
}

function BrandCarouselSection({ config }: { config: BrandCarouselConfig }) {
  const items = config.items.filter((i) => i.imageUrl);
  if (items.length === 0) return null;
  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      <div className="flex items-center gap-6 overflow-x-auto">
        {items.map((item, i) => {
          // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
          const img = <img src={item.imageUrl} alt="" className="h-10 w-auto object-contain grayscale opacity-70 shrink-0" />;
          return item.link ? (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer">
              {img}
            </a>
          ) : (
            <div key={i}>{img}</div>
          );
        })}
      </div>
    </div>
  );
}

function embedVideoUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function VideoSection({ config }: { config: VideoConfig }) {
  const embedUrl = config.url ? embedVideoUrl(config.url) : null;
  if (!embedUrl) return null;
  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      {config.title && (
        <h2 className="font-display text-xl font-semibold text-brand-ink mb-4">{config.title}</h2>
      )}
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          title={config.title || "Video"}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function InstagramCtaSection({
  config,
  instagramHandle,
}: {
  config: InstagramCtaConfig;
  instagramHandle: string | null;
}) {
  if (!instagramHandle) return null;
  return (
    <a
      href={`https://instagram.com/${instagramHandle.replace(/^@/, "")}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`block max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD} text-center hover:opacity-90`}
    >
      <p className="font-display text-lg font-semibold text-brand-ink">{config.title}</p>
      {config.description && (
        <p className="text-sm text-brand-ink-soft mt-1">{config.description}</p>
      )}
      <p className="text-sm text-brand-accent font-medium mt-2">@{instagramHandle.replace(/^@/, "")} →</p>
    </a>
  );
}

/// Tarjetas por fila: en celular una (o dos si son solo fotos), y en
/// computador las que eligió la marca. Clases escritas completas para que
/// Tailwind las vea.
const CARD_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

function CustomBlockButton({
  text,
  link,
  basePath,
  className = "",
  style,
}: {
  text: string;
  link: string;
  basePath: string;
  className?: string;
  /// En un bloque con colores propios, el botón va con esos colores (el del
  /// tema puede no verse sobre ese fondo).
  style?: React.CSSProperties;
}) {
  const href = resolveLink(link, basePath);
  if (!text || !href) return null;
  return (
    <Link
      href={href}
      style={style}
      className={`inline-block rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-90 ${style ? "" : "bg-brand-button text-brand-button-text"} ${className}`}
    >
      {text}
    </Link>
  );
}

/// Bloque personalizado (ver CUSTOM_BLOCK en storefront-sections.ts): con
/// colores propios, el texto toma el color del bloque en vez del del tema.
function CustomBlockSection({ config, basePath }: { config: CustomBlockConfig; basePath: string }) {
  const items: CustomBlockItem[] = (config.items ?? []).filter((i) => i.imageUrl || i.title || i.text);
  const layout = config.layout ?? "cards";
  const image = config.imageUrl || "";
  const hasHeader = Boolean(config.title || config.text || (config.buttonText && config.buttonLink));
  if (!hasHeader && items.length === 0 && !(layout === "image-text" && image)) return null;
  const colored = Boolean(config.textColor);
  const ink = colored ? "" : "text-brand-ink";
  const soft = colored ? "opacity-80" : "text-brand-ink-soft";
  const center = config.align !== "left";
  const line = { borderColor: "color-mix(in srgb, currentColor 15%, transparent)" };
  const buttonStyle = config.textColor
    ? { backgroundColor: config.textColor, color: config.background || contrastTextFor(config.textColor) }
    : undefined;

  const header = hasHeader ? (
    <div className={center ? "text-center mx-auto max-w-2xl" : "max-w-2xl"}>
      {config.title && <h2 className={`font-display text-xl sm:text-2xl font-semibold ${ink}`}>{config.title}</h2>}
      {config.text && <p className={`text-sm sm:text-base ${soft} whitespace-pre-line ${config.title ? "mt-2" : ""}`}>{config.text}</p>}
      <CustomBlockButton text={config.buttonText} link={config.buttonLink} basePath={basePath} className="mt-5" style={buttonStyle} />
    </div>
  ) : null;

  const itemLink = (item: CustomBlockItem, body: React.ReactNode, key: number, className = "") => {
    const href = !item.buttonText ? resolveLink(item.link, basePath) : null;
    return href ? (
      <Link key={key} href={href} className={`block hover:opacity-90 ${className}`}>
        {body}
      </Link>
    ) : (
      <div key={key} className={className}>
        {body}
      </div>
    );
  };

  let content: React.ReactNode = null;
  if (layout === "accordion") {
    content = items.length > 0 && (
      <div className={`border-t max-w-3xl ${center ? "mx-auto" : ""}`} style={line}>
        {items.map((item, i) => (
          <details key={i} className="group border-b py-4" style={line}>
            <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-sm sm:text-base font-medium ${ink}`}>
              <span>{item.title || item.text.slice(0, 80)}</span>
              <span aria-hidden className="text-xl leading-none transition-transform group-open:rotate-45">+</span>
            </summary>
            {item.title && item.text && <p className={`mt-2 text-sm ${soft} whitespace-pre-line`}>{item.text}</p>}
            <CustomBlockButton text={item.buttonText} link={item.link} basePath={basePath} className="mt-3" style={buttonStyle} />
          </details>
        ))}
      </div>
    );
  } else if (layout === "quotes") {
    content = items.length > 0 && (
      <div className={items.length > 3 ? "flex gap-4 overflow-x-auto snap-x pb-1" : `grid gap-4 grid-cols-1 ${CARD_COLUMNS[Math.min(3, items.length)]}`}>
        {items.map((item, i) => (
          <figure
            key={i}
            className={`rounded-2xl border p-5 flex flex-col gap-3 ${items.length > 3 ? "w-72 sm:w-80 shrink-0 snap-start" : ""}`}
            style={line}
          >
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- foto de quien da el testimonio
              <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-full object-cover" loading="lazy" />
            )}
            {item.text && <blockquote className={`text-sm ${ink} whitespace-pre-line`}>“{item.text}”</blockquote>}
            {item.title && <figcaption className={`text-xs font-semibold ${soft}`}>{item.title}</figcaption>}
          </figure>
        ))}
      </div>
    );
  } else if (layout === "cards") {
    const onlyImages = items.every((i) => i.imageUrl && !i.title && !i.text);
    const columns = Math.max(1, Math.min(6, config.columns || 3));
    content = items.length > 0 && (
      <div className={`grid gap-4 sm:gap-6 ${onlyImages || columns >= 4 ? "grid-cols-2" : "grid-cols-1"} ${CARD_COLUMNS[columns]}`}>
        {items.map((item, i) =>
          itemLink(
            item,
            <>
              {item.imageUrl && (
                <div className="rounded-2xl overflow-hidden">
                  <StoreImage src={item.imageUrl} alt="" natural sizes={`(min-width: 1024px) ${Math.round(100 / columns)}vw, 50vw`} />
                </div>
              )}
              {(item.title || item.text) && (
                <div className={`${item.imageUrl ? "mt-3" : ""} ${center ? "text-center" : ""}`}>
                  {item.title && <p className={`font-display text-base font-semibold ${ink}`}>{item.title}</p>}
                  {item.text && <p className={`text-sm ${soft} whitespace-pre-line ${item.title ? "mt-1" : ""}`}>{item.text}</p>}
                </div>
              )}
              <CustomBlockButton text={item.buttonText} link={item.link} basePath={basePath} className="mt-3" style={buttonStyle} />
            </>,
            i,
            center ? "text-center" : "",
          ),
        )}
      </div>
    );
  } else {
    // Texto con botón e imagen con texto: lo de cada ítem va como una
    // lista corta debajo del texto.
    content = items.length > 0 && (
      <ul className={`space-y-3 ${center && layout === "text" ? "max-w-2xl mx-auto text-center" : ""}`}>
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 items-start">
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- ícono del bloque
              <img src={item.imageUrl} alt="" className="w-10 h-10 object-contain shrink-0" loading="lazy" />
            )}
            <div className="flex-1">
              {item.title && <p className={`text-sm font-semibold ${ink}`}>{item.title}</p>}
              {item.text && <p className={`text-sm ${soft} whitespace-pre-line`}>{item.text}</p>}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const inner =
    layout === "image-text" ? (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
        {image && (
          <div className={`rounded-2xl overflow-hidden ${config.imagePosition === "right" ? "md:order-2" : ""}`}>
            <StoreImage src={image} alt="" natural sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        )}
        <div className={`space-y-5 ${image ? "" : "md:col-span-2"}`}>
          {header}
          {content}
        </div>
      </div>
    ) : (
      <div className="space-y-6">
        {header}
        {content}
      </div>
    );

  return (
    <section
      style={{ backgroundColor: config.background || undefined, color: config.textColor || undefined }}
    >
      {/* Con fondo de color, un poco más de aire adentro de la franja. */}
      <div
        className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${
          config.background ? "py-[calc(var(--section-pad-y,16px)*1.75)] sm:py-[calc(var(--section-pad-y-lg,26px)*1.5)]" : SECTION_PAD
        }`}
      >
        {inner}
      </div>
    </section>
  );
}

/// Todo el catálogo activo, en la plantilla elegida por la marca — antes
/// vivía fijo en la página de inicio (`t/[slug]/page.tsx`), ahora es una
/// sección más que se agrega/quita/reordena desde Diseño → Página de
/// inicio, como cualquier otra. Ver conversación del 2026-09-15.
async function ProductCatalogSection({
  config,
  brandId,
  basePath,
  template,
  productsPerRow,
  showSoldOut = false,
}: {
  config: ProductCatalogConfig;
  brandId: string;
  basePath: string;
  template: string;
  productsPerRow?: "1-3" | "2-4";
  showSoldOut?: boolean;
}) {
  const products = await listStorefrontProducts(brandId, { showSoldOut });
  return (
    <div className={`max-w-[1600px] mx-auto px-4 sm:px-8 ${SECTION_PAD}`}>
      {config.title && (
        <h2 className="font-display text-xl font-semibold text-brand-ink mb-4">{config.title}</h2>
      )}
      {products.length === 0 ? (
        <p className="text-sm text-brand-ink-soft text-center py-16">
          Todavía no hay productos publicados en esta tienda.
        </p>
      ) : (
        <CatalogTemplate
          template={template}
          basePath={basePath}
          productsPerRow={productsPerRow}
          products={products.map(toCardProduct)}
        />
      )}
    </div>
  );
}

export async function StorefrontSections({
  sections,
  brandId,
  basePath,
  instagramHandle = null,
  template = "CLASICA",
  productsPerRow,
  showSoldOut = false,
}: {
  sections: { id: string; type: string; config: unknown }[];
  brandId: string;
  basePath: string;
  instagramHandle?: string | null;
  /// Solo hacen falta cuando alguna sección es PRODUCT_CATALOG — el resto
  /// de las secciones no dependen de la plantilla del catálogo.
  template?: string;
  productsPerRow?: "1-3" | "2-4";
  /// Diseño → Página de colecciones → "Mostrar productos agotados".
  showSoldOut?: boolean;
}) {
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((s, index) => {
        switch (s.type) {
          case "BANNER":
            return <BannerSection key={s.id} config={s.config as BannerConfig} basePath={basePath} />;
          case "FEATURED_COLLECTION":
            return (
              <FeaturedCollectionSection
                key={s.id}
                config={s.config as FeaturedCollectionConfig}
                brandId={brandId}
                basePath={basePath}
                showSoldOut={showSoldOut}
              />
            );
          case "TEXT": {
            // Pegado a lo que sigue, salvo que sea una foto a lo ancho (no
            // trae espacio propio y el título quedaría encima de la foto).
            const next = sections[index + 1]?.type;
            const asHeading = Boolean(next) && next !== "BANNER" && next !== "IMAGE_CAROUSEL";
            return <TextSection key={s.id} config={s.config as TextConfig} asHeading={asHeading} />;
          }
          case "IMAGE_CAROUSEL":
            return <ImageCarouselSection key={s.id} config={s.config as ImageCarouselConfig} />;
          case "SHIPPING_INFO_BANNERS":
            return (
              <ShippingInfoBannersSection key={s.id} config={s.config as ShippingInfoBannersConfig} />
            );
          case "CATEGORY_BANNERS":
            return (
              <CategoryBannersSection
                key={s.id}
                config={s.config as CategoryBannersConfig}
                brandId={brandId}
                basePath={basePath}
              />
            );
          case "CATEGORY_GRID":
            return (
              <CategoryGridSection
                key={s.id}
                config={s.config as CategoryGridConfig}
                brandId={brandId}
                basePath={basePath}
              />
            );
          case "PROMO_BANNERS":
            return (
              <PromoBannersSection key={s.id} config={s.config as PromoBannersConfig} basePath={basePath} />
            );
          case "FEATURED_PRODUCTS":
            return (
              <FeaturedProductsSection
                key={s.id}
                config={s.config as FeaturedProductsConfig}
                brandId={brandId}
                basePath={basePath}
                showSoldOut={showSoldOut}
              />
            );
          case "NEW_PRODUCTS":
            return (
              <NewProductsSection
                key={s.id}
                config={s.config as NewProductsConfig}
                brandId={brandId}
                basePath={basePath}
                showSoldOut={showSoldOut}
              />
            );
          case "ON_SALE_PRODUCTS":
            return (
              <OnSaleProductsSection
                key={s.id}
                config={s.config as OnSaleProductsConfig}
                brandId={brandId}
                basePath={basePath}
                showSoldOut={showSoldOut}
              />
            );
          case "BRAND_CAROUSEL":
            return <BrandCarouselSection key={s.id} config={s.config as BrandCarouselConfig} />;
          case "VIDEO":
            return <VideoSection key={s.id} config={s.config as VideoConfig} />;
          case "INSTAGRAM_CTA":
            return (
              <InstagramCtaSection
                key={s.id}
                config={s.config as InstagramCtaConfig}
                instagramHandle={instagramHandle}
              />
            );
          case "CUSTOM_BLOCK":
            return <CustomBlockSection key={s.id} config={s.config as CustomBlockConfig} basePath={basePath} />;
          case "PRODUCT_CATALOG":
            return (
              <ProductCatalogSection
                key={s.id}
                config={s.config as ProductCatalogConfig}
                brandId={brandId}
                basePath={basePath}
                showSoldOut={showSoldOut}
                template={template}
                productsPerRow={productsPerRow}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
