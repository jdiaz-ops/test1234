import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import {
  getPublicStorePage,
  listStorefrontMenuItems,
} from "@/server/services/store-page-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStoreBasePath } from "@/lib/store-base-path";
import { sanitizeProductDescription, stripHtml } from "@/lib/sanitize-html";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  const page = await getPublicStorePage(brand.id, pageSlug);
  if (!page) return {};
  return {
    title: `${page.title} — ${brand.companyName}`,
    description: page.body ? stripHtml(page.body) : undefined,
  };
}

export default async function StorefrontPagePage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
}) {
  const { slug, pageSlug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const page = await getPublicStorePage(brand.id, pageSlug);
  if (!page) notFound();

  const [basePath, menuItems] = await Promise.all([
    getStoreBasePath(slug),
    listStorefrontMenuItems(brand.id),
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
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
          {page.title}
        </h1>
        {page.body ? (
          <div
            className="rich-text-content text-sm text-brand-ink-soft"
            // Ya viene saneado desde store-page-service.ts al guardar —
            // se vuelve a sanear acá por consistencia con el resto de
            // contenido enriquecido de la vitrina (ver
            // [productSlug]/page.tsx).
            dangerouslySetInnerHTML={{
              __html: sanitizeProductDescription(page.body),
            }}
          />
        ) : (
          <p className="text-sm text-brand-ink-soft">
            Esta página todavía no tiene contenido.
          </p>
        )}
      </div>
    </div>
  );
}
