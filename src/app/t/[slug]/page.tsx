import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getStorefrontBrand,
  listStorefrontProducts,
} from "@/server/services/store-order-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { getStoreBasePath } from "@/lib/store-base-path";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden flex flex-col"
                >
                  <Link href={`${basePath}/${product.slug}`}>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-brand-accent-soft" />
                    )}
                  </Link>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <Link href={`${basePath}/${product.slug}`}>
                      {product.type === "SERVICE" && (
                        <p className="text-[10px] font-mono text-brand-accent mb-0.5">
                          SERVICIO
                        </p>
                      )}
                      <p className="text-xs font-medium text-brand-ink leading-snug line-clamp-2">
                        {product.name}
                      </p>
                    </Link>
                    <p className="text-xs font-mono text-brand-ink-soft">
                      {formatCOP(Number(product.price))}
                    </p>
                    <div className="mt-auto">
                      <AddToCartButton
                        product={{
                          id: product.id,
                          slug: product.slug ?? "",
                          name: product.name,
                          price: Number(product.price),
                          imageUrl: product.imageUrl,
                          stock: product.stock,
                          type: product.type,
                        }}
                        className="w-full bg-brand-accent text-white rounded-full px-3 py-1.5 text-[11px] font-semibold hover:opacity-90 disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-center mt-14 font-mono text-xs text-brand-ink-soft">
            Vendido por {brand.companyName} vía Marcolini
          </p>
        </div>
      </div>
    </CartProvider>
  );
}
