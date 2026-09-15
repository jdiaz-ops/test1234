import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontBrand,
  searchStorefrontProducts,
} from "@/server/services/store-order-service";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { CollectionProductGrid } from "@/components/storefront/collection-product-grid";
import { getStoreBasePath } from "@/lib/store-base-path";
import { getPublishedTheme } from "@/server/services/brand-theme-service";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { q } = await searchParams;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  const title = q ? `"${q}" — ${brand.companyName}` : `Buscar — ${brand.companyName}`;
  return { title };
}

/// Resultados del buscador del encabezado (ver theme.header.mobile.show
/// === "search" en store-header.tsx) — mismo formulario GET simple que
/// el resto de la vitrina, sin autocompletar ni JS: funciona con o sin
/// hidratación. Ver conversación del 2026-09-15.
export default async function StorefrontSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q = "" } = await searchParams;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const [menuItems, basePath, theme, products] = await Promise.all([
    listStorefrontMenuItems(brand.id),
    getStoreBasePath(slug),
    getPublishedTheme(brand.id),
    searchStorefrontProducts(brand.id, q),
  ]);

  return (
    <div className="min-h-screen bg-brand-bg">
      <StoreHeader
        brandSlug={slug}
        brandName={brand.companyName}
        logoUrl={brand.logoUrl}
        basePath={basePath}
        menuItems={menuItems.map((i) => ({ id: i.id, label: i.label, url: i.url }))}
      />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <form action={`${basePath}/buscar`} method="GET" role="search" className="mb-6 sm:hidden">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar"
            autoFocus={!q}
            className="w-full rounded-full border border-brand-line bg-brand-surface px-4 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
        </form>
        {q ? (
          <p className="text-sm text-brand-ink-soft mb-6">
            {products.length === 0
              ? <>No encontramos productos para &quot;{q}&quot;.</>
              : <>{products.length} resultado{products.length === 1 ? "" : "s"} para &quot;{q}&quot;</>}
          </p>
        ) : (
          <p className="text-sm text-brand-ink-soft text-center py-16">Escribe algo para buscar en la tienda.</p>
        )}

        {products.length > 0 && (
          <CollectionProductGrid
            basePath={basePath}
            config={theme.collections}
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
  );
}
