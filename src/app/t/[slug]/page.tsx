import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontBrand,
  listStorefrontProducts,
} from "@/server/services/store-order-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { CatalogTemplate } from "@/components/storefront/catalog-templates";
import { StorefrontSections } from "@/components/storefront/storefront-sections";
import { getStoreBasePath } from "@/lib/store-base-path";
import { listEnabledStorefrontSections } from "@/server/services/storefront-section-service";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { getPublishedTheme } from "@/server/services/brand-theme-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  const title = `${brand.companyName} en Marcolini`;
  const description =
    brand.description || `Compra directo con ${brand.companyName}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function StorefrontCatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const [products, basePath, sections, menuItems, theme] = await Promise.all([
    listStorefrontProducts(brand.id),
    getStoreBasePath(slug),
    listEnabledStorefrontSections(brand.id),
    listStorefrontMenuItems(brand.id),
    getPublishedTheme(brand.id),
  ]);

  return (
    <div className="min-h-screen bg-brand-bg">
      <StoreHeader
        brandSlug={slug}
        brandName={brand.companyName}
        logoUrl={brand.logoUrl}
        basePath={basePath}
        menuItems={menuItems}
      />
      <StorefrontSections
        sections={sections.map((s) => ({ id: s.id, type: s.type, config: s.config }))}
        brandId={brand.id}
        basePath={basePath}
        instagramHandle={brand.instagramHandle}
      />
      <div className="max-w-3xl mx-auto px-6 py-10">
        {brand.description && (
          <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
            {brand.description}
          </p>
        )}

        {products.length === 0 ? (
          <p className="text-sm text-brand-ink-soft text-center py-16">
            Todavía no hay productos publicados en esta tienda.
          </p>
        ) : (
          <CatalogTemplate
            template={brand.storefrontTemplate}
            basePath={basePath}
            productsPerRow={theme.productListing.productsPerRow}
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

        <p className="text-center mt-14 font-mono text-xs text-brand-ink-soft">
          Vendido por {brand.companyName} vía Marcolini
        </p>
      </div>
    </div>
  );
}
