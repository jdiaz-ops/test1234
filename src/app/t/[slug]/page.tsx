import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontBrand,
  listStorefrontProducts,
} from "@/server/services/store-order-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { CatalogTemplate } from "@/components/storefront/catalog-templates";
import { getStoreBasePath } from "@/lib/store-base-path";

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

  const [products, basePath] = await Promise.all([
    listStorefrontProducts(brand.id),
    getStoreBasePath(slug),
  ]);

  return (
    <CartProvider brandSlug={slug}>
      <div className="min-h-screen bg-brand-bg">
        <StoreHeader
          brandSlug={slug}
          brandName={brand.companyName}
          logoUrl={brand.logoUrl}
          basePath={basePath}
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
    </CartProvider>
  );
}
