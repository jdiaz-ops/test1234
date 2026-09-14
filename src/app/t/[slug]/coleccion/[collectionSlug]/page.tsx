import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { getPublicBrandCollection } from "@/server/services/brand-collection-service";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { CatalogTemplate } from "@/components/storefront/catalog-templates";
import { getStoreBasePath } from "@/lib/store-base-path";
import { stripHtml } from "@/lib/sanitize-html";
import { getPublishedTheme } from "@/server/services/brand-theme-service";

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

  const [menuItems, basePath, theme] = await Promise.all([
    listStorefrontMenuItems(brand.id),
    getStoreBasePath(slug),
    getPublishedTheme(brand.id),
  ]);

  const products = collection.products.map((p) => p.product);

  return (
    <CartProvider brandSlug={slug}>
      <div className="min-h-screen bg-brand-bg">
        <StoreHeader
          brandSlug={slug}
          brandName={brand.companyName}
          logoUrl={brand.logoUrl}
          basePath={basePath}
          menuItems={menuItems.map((i) => ({ id: i.id, label: i.label, url: i.url }))}
        />
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
            COLECCIÓN
          </p>
          <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">{collection.description}</p>
          )}

          {products.length === 0 ? (
            <p className="text-sm text-brand-ink-soft text-center py-16">
              Todavía no hay productos en esta colección.
            </p>
          ) : (
            <CatalogTemplate
              template={brand.storefrontTemplate}
              basePath={basePath}
              cardButtonStyle={theme.collections.cardButtonStyle}
              products={products.map((p) => ({
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: Number(p.price),
                imageUrl: p.imageUrl,
                stock: p.stock,
                type: p.type,
              }))}
            />
          )}
        </div>
      </div>
    </CartProvider>
  );
}
