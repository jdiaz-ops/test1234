import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStorefrontBrand,
  getStorefrontProduct,
} from "@/server/services/store-order-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { getStoreBasePath } from "@/lib/store-base-path";
import { sanitizeProductDescription, stripHtml } from "@/lib/sanitize-html";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";

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
    description: product.description
      ? stripHtml(product.description)
      : undefined,
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
  const isDigital = product.type === "DIGITAL";
  const [basePath, menuItems] = await Promise.all([
    getStoreBasePath(slug),
    listStorefrontMenuItems(brand.id),
  ]);

  return (
    <CartProvider brandSlug={slug}>
      <div className="min-h-screen bg-brand-bg">
        <StoreHeader
          brandSlug={slug}
          brandName={brand.companyName}
          logoUrl={brand.logoUrl}
          basePath={basePath}
          menuItems={menuItems}
        />
        <div className="max-w-3xl mx-auto px-6 py-10 grid sm:grid-cols-2 gap-8">
          <div>
            <ProductGallery
              images={
                product.images.length > 0
                  ? product.images.map((img) => img.url)
                  : product.imageUrl
                    ? [product.imageUrl]
                    : []
              }
              alt={product.name}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-mono text-xs text-brand-accent tracking-widest mb-1">
                {isService
                  ? "SERVICIO"
                  : isDigital
                    ? "PRODUCTO DIGITAL"
                    : brand.companyName.toUpperCase()}
              </p>
              <h1 className="font-display text-2xl font-semibold text-brand-ink">
                {product.name}
              </h1>
            </div>

            {!product.hasVariants && (
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
            )}

            {product.description && (
              <div
                className="rich-text-content text-sm text-brand-ink-soft"
                // Ya viene saneado desde brand-store-product-service.ts al
                // guardar — se vuelve a sanear acá por si algún otro camino
                // de escritura (ej. una futura sincronización) se lo salta.
                dangerouslySetInnerHTML={{
                  __html: sanitizeProductDescription(product.description),
                }}
              />
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

            {isDigital && (
              <div className="rounded-xl border border-brand-line p-3 text-sm text-brand-ink-soft">
                📎 Recibes el link de descarga/acceso apenas se confirme tu
                pago — no se envía nada físico.
              </div>
            )}

            {!product.hasVariants && (
              <>
                {outOfStock ? (
                  <p className="text-sm text-brand-ink-soft">
                    {isService
                      ? "Sin cupos disponibles por ahora."
                      : "Este producto está agotado por ahora."}
                  </p>
                ) : product.stock != null ? (
                  <p className="text-xs text-brand-ink-soft">
                    {product.stock}{" "}
                    {isService ? "cupos disponibles" : "disponibles"}
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
              </>
            )}

            {product.hasVariants && (
              <VariantPicker
                productId={product.id}
                productSlug={product.slug ?? ""}
                productName={product.name}
                basePrice={Number(product.price)}
                baseImageUrl={product.imageUrl}
                optionNames={product.optionNames}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  option1Value: v.option1Value,
                  option2Value: v.option2Value,
                  option3Value: v.option3Value,
                  price: v.price != null ? Number(v.price) : null,
                  imageUrl: v.imageUrl,
                  stock: v.stock,
                }))}
              />
            )}
          </div>
        </div>
      </div>
    </CartProvider>
  );
}
