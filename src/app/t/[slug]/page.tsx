import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { StoreHeader } from "@/components/storefront/store-header";
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

  const [basePath, sections, menuItems, theme] = await Promise.all([
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
      {/* Diseño → Página de inicio es el único lugar para agregar o quitar
          elementos de la home — la descripción de la marca y el catálogo
          ya no viven fijos acá, son secciones más (TEXT / PRODUCT_CATALOG).
          Ver conversación del 2026-09-15. */}
      <StorefrontSections
        sections={sections.map((s) => ({ id: s.id, type: s.type, config: s.config }))}
        brandId={brand.id}
        basePath={basePath}
        instagramHandle={brand.instagramHandle}
        template={brand.storefrontTemplate}
        productsPerRow={theme.productListing.productsPerRow}
      />
      <p className="text-center mt-4 mb-10 font-mono text-xs text-brand-ink-soft">
        Vendido por {brand.companyName} vía Marcolini
      </p>
    </div>
  );
}
