import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { getPublicBrandCollections } from "@/server/services/brand-collection-service";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { getStoreBasePath } from "@/lib/store-base-path";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  return { title: `Categorías — ${brand.companyName}` };
}

/// Landing "todas las categorías" — el destino por defecto del ítem
/// "Categorías" del navegador móvil (ver theme.mobileNav) y de cualquier
/// link manual a /coleccion. Antes solo existía /coleccion/{slug} para
/// una colección puntual; esta es la vista índice que las lista todas.
export default async function StorefrontCollectionsIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const [collections, menuItems, basePath] = await Promise.all([
    getPublicBrandCollections(brand.id),
    listStorefrontMenuItems(brand.id),
    getStoreBasePath(slug),
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
      <div className="max-w-3xl mx-auto px-6 py-10">
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
          CATEGORÍAS
        </p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">
          Todas las categorías
        </h1>

        {collections.length === 0 ? (
          <p className="text-sm text-brand-ink-soft text-center py-16">
            Todavía no hay categorías con productos publicados.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`${basePath}/coleccion/${c.slug}`}
                className="rounded-xl overflow-hidden border border-brand-line bg-brand-surface block group"
              >
                <div className="aspect-square bg-brand-accent-soft relative overflow-hidden">
                  {c.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <p className="text-sm font-medium text-brand-ink text-center py-2.5 px-2 truncate">
                  {c.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
