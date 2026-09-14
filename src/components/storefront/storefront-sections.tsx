import Link from "next/link";
import type {
  BannerConfig,
  FeaturedCollectionConfig,
  TextConfig,
} from "@/lib/storefront-sections";
import { getBrandCollection } from "@/server/services/brand-collection-service";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
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
              href={
                config.buttonLink.startsWith("http") || config.buttonLink.startsWith("/")
                  ? config.buttonLink.startsWith("/")
                    ? `${basePath}${config.buttonLink}`
                    : config.buttonLink
                  : `${basePath}/${config.buttonLink}`
              }
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

export async function StorefrontSections({
  sections,
  brandId,
  basePath,
}: {
  sections: { id: string; type: string; config: unknown }[];
  brandId: string;
  basePath: string;
}) {
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((s) => {
        if (s.type === "BANNER") {
          return (
            <BannerSection
              key={s.id}
              config={s.config as BannerConfig}
              basePath={basePath}
            />
          );
        }
        if (s.type === "FEATURED_COLLECTION") {
          return (
            <FeaturedCollectionSection
              key={s.id}
              config={s.config as FeaturedCollectionConfig}
              brandId={brandId}
              basePath={basePath}
            />
          );
        }
        if (s.type === "TEXT") {
          return <TextSection key={s.id} config={s.config as TextConfig} />;
        }
        return null;
      })}
    </>
  );
}
