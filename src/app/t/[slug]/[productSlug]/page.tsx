import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getStorefrontBrand,
  getStorefrontProduct,
  getRelatedProducts,
} from "@/server/services/store-order-service";
import { CartProvider } from "@/components/storefront/cart-context";
import { StoreHeader } from "@/components/storefront/store-header";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductShippingCalculator } from "@/components/storefront/product-shipping-calculator";
import { FloatingAddToCartBar } from "@/components/storefront/floating-add-to-cart-bar";
import { getStoreBasePath } from "@/lib/store-base-path";
import { sanitizeProductDescription, stripHtml } from "@/lib/sanitize-html";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { getPublishedTheme } from "@/server/services/brand-theme-service";
import { TRUST_ICON_OPTIONS } from "@/lib/brand-theme";

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
  const [basePath, menuItems, theme, relatedProducts] = await Promise.all([
    getStoreBasePath(slug),
    listStorefrontMenuItems(brand.id),
    getPublishedTheme(brand.id),
    getRelatedProducts(brand.id, product.id),
  ]);
  const { productDetail } = theme;
  const savedAmountPercent =
    productDetail.showSavedAmount && product.compareAtPrice && !product.hasVariants
      ? Math.round(
          (1 - Number(product.price) / Number(product.compareAtPrice)) * 100,
        )
      : null;
  const lowStockActive =
    productDetail.lowStock.enabled &&
    !product.hasVariants &&
    product.stock != null &&
    product.stock > 0 &&
    product.stock <= productDetail.lowStock.threshold;
  const sizeGuideUrl = productDetail.sizeGuidePageSlug
    ? `${basePath}/pagina/${productDetail.sizeGuidePageSlug}`
    : null;
  const activePurchaseInfo = productDetail.purchaseInfo.filter((i) => i.show && (i.title || i.description));

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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg text-brand-ink">
                  {formatCOP(Number(product.price))}
                </span>
                {product.compareAtPrice && (
                  <span className="font-mono text-sm text-brand-ink-soft line-through">
                    {formatCOP(Number(product.compareAtPrice))}
                  </span>
                )}
                {savedAmountPercent != null && savedAmountPercent > 0 && (
                  <span
                    className="text-xs font-medium rounded-full px-2 py-0.5"
                    style={{ background: "var(--brand-highlight)", color: "#fff" }}
                  >
                    Ahorras {savedAmountPercent}%
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
                ) : productDetail.showStock && product.stock != null ? (
                  <p className="text-xs text-brand-ink-soft">
                    {product.stock}{" "}
                    {isService ? "cupos disponibles" : "disponibles"}
                  </p>
                ) : null}

                {lowStockActive && (
                  <p className="text-xs font-medium" style={{ color: "var(--brand-highlight)" }}>
                    {product.stock === 1
                      ? productDetail.lowStock.lastUnitMessage
                      : `¡Quedan solo ${product.stock}!`}
                  </p>
                )}

                <AddToCartButton
                  basePath={basePath}
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

                {productDetail.shippingCalculator && !isService && !isDigital && (
                  <ProductShippingCalculator
                    brandSlug={slug}
                    priceCents={Math.round(Number(product.price) * 100)}
                    weightKg={product.weight != null ? Number(product.weight) : 0}
                  />
                )}
              </>
            )}

            {product.hasVariants && (
              <>
                <VariantPicker
                  productId={product.id}
                  productSlug={product.slug ?? ""}
                  productName={product.name}
                  basePrice={Number(product.price)}
                  baseImageUrl={product.imageUrl}
                  optionNames={product.optionNames}
                  basePath={basePath}
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
                {sizeGuideUrl && (
                  <Link href={sizeGuideUrl} className="text-xs text-brand-accent hover:underline w-fit">
                    Ver guía de tallas ↗
                  </Link>
                )}
              </>
            )}

            {/* Marca invisible justo debajo del botón principal — la
                barra flotante de abajo la observa para saber cuándo
                aparecer (cuando este punto sale del viewport). */}
            <div id="pdp-cta-sentinel" />

            {activePurchaseInfo.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {activePurchaseInfo.map((item, i) => {
                  const emoji = TRUST_ICON_OPTIONS.find((o) => o.value === item.icon)?.emoji;
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {emoji && <span>{emoji}</span>}
                      <div>
                        {item.title && <p className="font-medium text-brand-ink">{item.title}</p>}
                        {item.description && <p className="text-brand-ink-soft">{item.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {productDetail.floatingAddToCart && (
          <FloatingAddToCartBar
            sentinelId="pdp-cta-sentinel"
            basePath={basePath}
            hasVariants={product.hasVariants}
            bottomOffsetClass={theme.mobileNav.enabled ? "bottom-16 sm:bottom-0" : "bottom-0"}
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
        )}

        {relatedProducts.length > 0 && (
          <div className="max-w-3xl mx-auto px-6 pb-14">
            <h2 className="font-display text-lg font-semibold text-brand-ink mb-4">
              {productDetail.relatedTitles.alternative}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`${basePath}/${p.slug}`}
                  className="rounded-xl border border-brand-line overflow-hidden bg-brand-surface block"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-brand-accent-soft" />
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium text-brand-ink truncate">{p.name}</p>
                    <p className="text-xs text-brand-ink-soft font-mono">{formatCOP(Number(p.price))}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </CartProvider>
  );
}
