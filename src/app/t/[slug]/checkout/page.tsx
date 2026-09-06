import { notFound } from "next/navigation";
import { getStorefrontBrand } from "@/server/services/store-order-service";
import { getActiveWompiKeys } from "@/server/integrations/wompi-client";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { CheckoutForm } from "@/components/storefront/checkout-form";

export default async function StorefrontCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const paymentsReady = getActiveWompiKeys(brand) !== null;

  return (
    <CartProvider brandSlug={slug}>
      <div className="min-h-screen bg-brand-bg">
        <StoreHeader
          brandSlug={slug}
          brandName={brand.companyName}
          logoUrl={brand.logoUrl}
        />
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
            CHECKOUT
          </p>
          <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
            Termina tu compra
          </h1>
          <CheckoutForm
            brandSlug={slug}
            shippingFlatRate={
              brand.shippingFlatRate
                ? Math.round(Number(brand.shippingFlatRate))
                : null
            }
            freeShippingThreshold={
              brand.freeShippingThreshold
                ? Math.round(Number(brand.freeShippingThreshold))
                : null
            }
            paymentsReady={paymentsReady}
          />
        </div>
      </div>
    </CartProvider>
  );
}
