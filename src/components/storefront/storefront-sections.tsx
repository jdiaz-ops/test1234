import Link from "next/link";
import type {
  BannerConfig,
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
} from "@/lib/storefront-sections";
import { TRUST_ICON_OPTIONS } from "@/lib/brand-theme";
import { getBrandCollection } from "@/server/services/brand-collection-service";
import { prisma } from "@/lib/prisma";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function trustIconEmoji(icon: string) {
  return TRUST_ICON_OPTIONS.find((i) => i.value === icon)?.emoji ?? null;
}

function resolveLink(link: string, basePath: string) {
  if (!link) return null;
  if (link.startsWith("http")) return link;
  if (link.startsWith("/")) return `${basePath}${link}`;
  return `${basePath}/${link}`;
}

function BannerSection({ config, basePath }: { config: BannerConfig; basePath: string }) {
  if (!config.imageUrl && !config.title) return null;
  return (
    <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] overflow-hidden bg-brand-accent-soft">
      {config.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
        <img
          src={config.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {(config.title || config.subtitle || config.buttonText) && (
        <div className="absolute inset-0 bg-black/25 flex flex-col items-center justify-center text-center px-6">
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
              className="mt-4 bg-white text-brand-ink text-sm font-medium rounded-full px-6 py-2.5 hover:opacity-90"
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
}: {
  config: FeaturedCollectionConfig;
  brandId: string;
  basePath: string;
}) {
  if (!config.collectionId) return null;
  const collection = await getBrandCollection(brandId, config.collectionId);
  if (!collection) return null;
  const products = collection.products
    .map((p) => p.product)
    .filter((p) => p.status === "ACTIVE" && p.available)
    .slice(0, 8);
  if (products.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="font-display text-xl font-semibold text-brand-ink mb-4">
        {config.title || collection.name}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`${basePath}/${p.slug}`}
            className="rounded-xl border border-brand-line overflow-hidden bg-brand-surface block"
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-brand-accent-soft" />
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-brand-ink truncate">{p.name}</p>
              <p className="text-xs text-brand-ink-soft font-mono">
                {formatCOP(Number(p.price))}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TextSection({ config }: { config: TextConfig }) {
  if (!config.heading && !config.body) return null;
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 text-center">
      {config.heading && (
        <h2 className="font-display text-xl font-semibold text-brand-ink mb-2">
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
      <div className="w-full aspect-[21/9] sm:aspect-[3/1] overflow-hidden bg-brand-accent-soft">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca */}
        <img src={images[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto snap-x snap-mandatory flex">
      {images.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
        <img
          key={i}
          src={url}
          alt=""
          className="w-full shrink-0 snap-center aspect-[21/9] sm:aspect-[3/1] object-cover"
        />
      ))}
    </div>
  );
}

function ShippingInfoBannersSection({ config }: { config: ShippingInfoBannersConfig }) {
  const items = config.items.filter((i) => i.show && (i.title || i.description));
  if (items.length === 0) return null;
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item, i) => {
          const emoji = trustIconEmoji(item.icon);
          const body = (
            <div className="text-center">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- icono subido por la marca
                <img src={item.imageUrl} alt="" className="w-8 h-8 mx-auto mb-2 object-contain" />
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
    <div className={`max-w-3xl mx-auto ${config.extendFullWidth ? "px-0" : "px-6"} py-8`}>
      <div className={`grid gap-3 ${items.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
        {items.map((item, i) => (
          <Link
            key={i}
            href={`${basePath}/coleccion/${item.collection!.slug}`}
            className="relative aspect-[4/3] rounded-xl overflow-hidden bg-brand-accent-soft block"
          >
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
              <img src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(collections.map((c) => [c.id, c]));
  const items = visible
    .map((i) => ({ ...i, collection: byId.get(i.collectionId!) }))
    .filter((i) => i.collection);
  if (items.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {items.map((item, i) => (
          <Link
            key={i}
            href={`${basePath}/coleccion/${item.collection!.slug}`}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className="w-full aspect-square rounded-full overflow-hidden bg-brand-accent-soft relative">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
                <img
                  src={item.imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
            </div>
            <p className="text-[11px] text-brand-ink text-center leading-tight line-clamp-2">
              {item.label || item.collection!.name}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PromoBannersSection({ config, basePath }: { config: PromoBannersConfig; basePath: string }) {
  const items = config.items.filter((i) => i.show && i.imageUrl);
  if (items.length === 0) return null;
  return (
    <div className={`max-w-3xl mx-auto ${config.extendFullWidth ? "px-0" : "px-6"} py-8`}>
      <div className={`grid gap-3 ${items.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
        {items.map((item, i) => {
          const href = resolveLink(item.link, basePath);
          const img = (
            // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
            <img src={item.imageUrl!} alt="" className="w-full aspect-[4/3] object-cover rounded-xl" />
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

function ProductGrid({
  title,
  products,
  display,
  basePath,
}: {
  title: string;
  products: { id: string; name: string; slug: string | null; imageUrl: string | null; price: unknown; compareAtPrice: unknown }[];
  display: "grid" | "carousel";
  basePath: string;
}) {
  if (products.length === 0) return null;
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {title && (
        <h2 className="font-display text-xl font-semibold text-brand-ink mb-4">{title}</h2>
      )}
      <div
        className={
          display === "carousel"
            ? "flex gap-4 overflow-x-auto snap-x pb-1"
            : "grid grid-cols-2 sm:grid-cols-4 gap-4"
        }
      >
        {products.map((p) => (
          <Link
            key={p.id}
            href={`${basePath}/${p.slug}`}
            className={`rounded-xl border border-brand-line overflow-hidden bg-brand-surface block ${
              display === "carousel" ? "w-36 sm:w-44 shrink-0 snap-start" : ""
            }`}
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-brand-accent-soft" />
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-brand-ink truncate">{p.name}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-brand-ink-soft font-mono">{formatCOP(Number(p.price))}</p>
                {p.compareAtPrice != null && Number(p.compareAtPrice) > Number(p.price) && (
                  <p className="text-[10px] text-brand-ink-soft/60 font-mono line-through">
                    {formatCOP(Number(p.compareAtPrice))}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function FeaturedProductsSection({
  config,
  brandId,
  basePath,
}: {
  config: FeaturedProductsConfig;
  brandId: string;
  basePath: string;
}) {
  if (config.productIds.length === 0) return null;
  const products = await prisma.product.findMany({
    where: { id: { in: config.productIds }, brandId, manual: true, status: "ACTIVE" },
    select: { id: true, name: true, slug: true, imageUrl: true, price: true, compareAtPrice: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = config.productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  return <ProductGrid title={config.title} products={ordered} display={config.display} basePath={basePath} />;
}

async function NewProductsSection({
  config,
  brandId,
  basePath,
}: {
  config: NewProductsConfig;
  brandId: string;
  basePath: string;
}) {
  const products = await prisma.product.findMany({
    where: { brandId, manual: true, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, name: true, slug: true, imageUrl: true, price: true, compareAtPrice: true },
  });
  return <ProductGrid title={config.title} products={products} display={config.display} basePath={basePath} />;
}

async function OnSaleProductsSection({
  config,
  brandId,
  basePath,
}: {
  config: OnSaleProductsConfig;
  brandId: string;
  basePath: string;
}) {
  // Prisma no compara dos columnas entre sí en el where — se trae un lote
  // razonable de productos activos y se filtra compareAtPrice > price en
  // memoria. Suficiente para el tamaño de catálogo de esta plataforma.
  const candidates = await prisma.product.findMany({
    where: { brandId, manual: true, status: "ACTIVE", compareAtPrice: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, name: true, slug: true, imageUrl: true, price: true, compareAtPrice: true },
  });
  const onSale = candidates
    .filter((p) => p.compareAtPrice != null && Number(p.compareAtPrice) > Number(p.price))
    .slice(0, 8);
  return <ProductGrid title={config.title} products={onSale} display={config.display} basePath={basePath} />;
}

function BrandCarouselSection({ config }: { config: BrandCarouselConfig }) {
  const items = config.items.filter((i) => i.imageUrl);
  if (items.length === 0) return null;
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
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
    <div className="max-w-3xl mx-auto px-6 py-10">
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
      className="block max-w-3xl mx-auto px-6 py-8 text-center hover:opacity-90"
    >
      <p className="font-display text-lg font-semibold text-brand-ink">{config.title}</p>
      {config.description && (
        <p className="text-sm text-brand-ink-soft mt-1">{config.description}</p>
      )}
      <p className="text-sm text-brand-accent font-medium mt-2">@{instagramHandle.replace(/^@/, "")} →</p>
    </a>
  );
}

export async function StorefrontSections({
  sections,
  brandId,
  basePath,
  instagramHandle = null,
}: {
  sections: { id: string; type: string; config: unknown }[];
  brandId: string;
  basePath: string;
  instagramHandle?: string | null;
}) {
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((s) => {
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
              />
            );
          case "TEXT":
            return <TextSection key={s.id} config={s.config as TextConfig} />;
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
              />
            );
          case "NEW_PRODUCTS":
            return (
              <NewProductsSection
                key={s.id}
                config={s.config as NewProductsConfig}
                brandId={brandId}
                basePath={basePath}
              />
            );
          case "ON_SALE_PRODUCTS":
            return (
              <OnSaleProductsSection
                key={s.id}
                config={s.config as OnSaleProductsConfig}
                brandId={brandId}
                basePath={basePath}
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
          default:
            return null;
        }
      })}
    </>
  );
}
