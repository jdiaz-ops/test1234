import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { getPublicBrandCollection } from "@/server/services/brand-collection-service";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { CollectionProductGrid } from "@/components/storefront/collection-product-grid";
import { getStoreBasePath } from "@/lib/store-base-path";
import { stripHtml } from "@/lib/sanitize-html";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; collectionSlug: string }>;
}): Promise<Metadata> {
  const { slug, collectionSlug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  const collection = await getPublicBrandCollection(brand.id, collectionSlug);
  if (!collection) return {};
  return {
    title: `${collection.name} — ${brand.companyName}`,
    description: collection.description ? stripHtml(collection.description) : undefined,
  };
}

/// Página pública de una colección — el grid completo de sus productos,
/// no solo la vista previa de 8 que muestra la sección "Colección
/// destacada" de la home. Enlazada desde CATEGORY_BANNERS y desde
/// cualquier link manual del menú (/coleccion/{slug}).
export default async function StorefrontCollectionPage({
  params,
}: {
  params: Promise<{ slug: string; collectionSlug: string }>;
}) {
  const { slug, collectionSlug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const collection = await getPublicBrandCollection(brand.id, collectionSlug);
  if (!collection) notFound();

  const [menuItems, basePath] = await Promise.all([
    listStorefrontMenuItems(brand.id),
    getStoreBasePath(slug),
  ]);

  const products = collection.products.map((p) => p.product);

  return (
    <div className="min-h-screen bg-brand-bg">
      <StoreHeader
        brandSlug={slug}
        brandName={brand.companyName}
        logoUrl={brand.logoUrl}
        basePath={basePath}
        menuItems={menuItems.map((i) => ({ id: i.id, label: i.label, url: i.url }))}
      />
      {/* Banner de borde a borde, con versión para celular si la marca la
          subió. Ver conversación del 2026-10-02. */}
      {collection.bannerUrl && (
        <picture className="block w-full bg-brand-accent-soft">
          {collection.bannerMobileUrl && <source media="(max-width: 639px)" srcSet={collection.bannerMobileUrl} />}
          <img src={collection.bannerUrl} alt={collection.name} className="block w-full h-auto" />
        </picture>
      )}
      {!collection.bannerUrl && collection.bannerMobileUrl && (
        // Solo subió el de celular: se usa en todos los tamaños.
        // eslint-disable-next-line @next/next/no-img-element -- banner subido por la marca
        <img src={collection.bannerMobileUrl} alt={collection.name} className="block w-full h-auto sm:max-h-[60vh] sm:object-cover" />
      )}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10">
        {!collection.bannerUrl && !collection.bannerMobileUrl && (
          <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
            COLECCIÓN
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
          {collection.name}
        </h1>
        {collection.description ? (
          <p className="text-sm text-brand-ink-soft mb-8 max-w-2xl whitespace-pre-line leading-relaxed">{collection.description}</p>
        ) : (
          <div className="mb-6" />
        )}

        {products.length === 0 ? (
          <p className="text-sm text-brand-ink-soft text-center py-16">
            Todavía no hay productos en esta colección.
          </p>
        ) : (
          <CollectionProductGrid
            basePath={basePath}
            products={products.map((p) => ({
              id: p.id,
              slug: p.slug,
              name: p.name,
              price: Number(p.price),
              compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
              imageUrl: p.imageUrl,
              stock: p.stock,
              type: p.type,
            }))}
          />
        )}
      </div>
    </div>
  );
}
