import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { CartList } from "@/components/storefront/cart-list";
import { getStoreBasePath } from "@/lib/store-base-path";

export default async function StorefrontCartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();
  const basePath = await getStoreBasePath(slug);

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
          <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
            CARRITO
          </p>
          <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
            Tu pedido en {brand.companyName}
          </h1>
          <CartList brandSlug={slug} basePath={basePath} />
        </div>
      </div>
    </CartProvider>
  );
}
