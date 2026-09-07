import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontBrand,
  getStorefrontProduct,
} from "@/server/services/store-order-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";

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
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) return {};
  const product = await getStorefrontProduct(brand.id, productSlug);
  if (!product) return {};
  return {
    title: `${product.name} — ${brand.companyName}`,
    description: product.description || undefined,
  };
}

export default async function StorefrontProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const brand = await getStorefrontBrand(slug);
  if (!brand) notFound();

  const product = await getStorefrontProduct(brand.id, productSlug);
  if (!product || !product.available) notFound();

  const outOfStock = product.stock != null && product.stock <= 0;
  const isService = product.type === "SERVICE";

  return (
    <CartProvider brandSlug={slug}>
      <div className="min-h-screen bg-brand-bg">
        <StoreHeader
          brandSlug={slug}
          brandName={brand.companyName}
          logoUrl={brand.logoUrl}
        />
        <div className="max-w-3xl mx-auto px-6 py-10 grid sm:grid-cols-2 gap-8">
          <div>
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full aspect-square object-cover rounded-2xl border border-brand-line"
              />
            ) : (
              <div className="w-full aspect-square bg-brand-accent-soft rounded-2xl" />
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-mono text-xs text-brand-accent tracking-widest mb-1">
                {isService ? "SERVICIO" : brand.companyName.toUpperCase()}
              </p>
              <h1 className="font-display text-2xl font-semibold text-brand-ink">
                {product.name}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-lg text-brand-ink">
                {formatCOP(Number(product.price))}
              </span>
              {product.compareAtPrice && (
                <span className="font-mono text-sm text-brand-ink-soft line-through">
                  {formatCOP(Number(product.compareAtPrice))}
                </span>
              )}
            </div>

            {product.description && (
              <p className="text-sm text-brand-ink-soft whitespace-pre-line">
                {product.description}
              </p>
            )}

            {isService && (
              <div className="rounded-xl border border-brand-line p-3 space-y-1.5 text-sm">
                <p className="text-brand-ink">
                  {product.serviceModality === "PRESENCIAL"
                    ? "📍 Presencial"
                    : "💻 Virtual (por videollamada)"}
                  {product.serviceDurationMinutes
                    ? ` · ${product.serviceDurationMinutes} min`
                    : ""}
                </p>
                {product.serviceLocation && (
                  <p className="text-brand-ink-soft text-xs">
                    {product.serviceModality === "PRESENCIAL"
                      ? product.serviceLocation
                      : "Te llega el link de la videollamada al confirmar tu reserva."}
                  </p>
                )}
              </div>
            )}

            {outOfStock ? (
              <p className="text-sm text-brand-ink-soft">
                {isService
                  ? "Sin cupos disponibles por ahora."
                  : "Este producto está agotado por ahora."}
              </p>
            ) : product.stock != null ? (
              <p className="text-xs text-brand-ink-soft">
                {product.stock} {isService ? "cupos disponibles" : "disponibles"}
              </p>
            ) : null}

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
            />
          </div>
        </div>
      </div>
    </CartProvider>
  );
}
