import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import {
  getStorefrontBrand,
  getStorefrontProduct,
  getRelatedProducts,
  findStorefrontProductByShopifyHandle,
} from "@/server/services/store-order-service";
import { StoreHeader } from "@/components/storefront/store-header";
import { QuantityAddToCart } from "@/components/storefront/quantity-add-to-cart";
import { ProductReviews, Stars } from "@/components/storefront/product-reviews";
import { getProductReviews } from "@/server/services/product-review-service";
import { REVIEWS_ENABLED } from "@/lib/features";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { FloatingAddToCartBar } from "@/components/storefront/floating-add-to-cart-bar";
import { ProductCard, ProductPrice, toCardProduct } from "@/components/storefront/product-card";
import { getStoreBasePath } from "@/lib/store-base-path";
import { sanitizeProductDescription, stripHtml } from "@/lib/sanitize-html";
import { listStorefrontMenuItems } from "@/server/services/store-page-service";
import { getStorefrontTheme } from "@/server/services/brand-theme-service";
import { TRUST_ICON_OPTIONS } from "@/lib/brand-theme";

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
  if (!product) {
    // URL vieja de Shopify (o de antes de que el editor conservara el
    // slug) → manda al slug actual del mismo producto. Ver
    // findStorefrontProductByShopifyHandle.
    const byHandle = await findStorefrontProductByShopifyHandle(brand.id, productSlug);
    if (byHandle?.slug && byHandle.slug !== productSlug) {
      permanentRedirect(`${await getStoreBasePath(slug)}/${byHandle.slug}`);
    }
    notFound();
  }
  if (!product.available) notFound();

  const outOfStock = product.stock != null && product.stock <= 0;
  const isService = product.type === "SERVICE";
  const isDigital = product.type === "DIGITAL";
  const [basePath, menuItems, theme, relatedProducts, reviewData] = await Promise.all([
    getStoreBasePath(slug),
    listStorefrontMenuItems(brand.id),
    getStorefrontTheme(brand.id),
    getRelatedProducts(brand.id, product.id),
    REVIEWS_ENABLED ? getProductReviews(product.id) : null,
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
    <div className="min-h-screen bg-brand-bg">
        <StoreHeader
          brandSlug={slug}
          brandName={brand.companyName}
          logoUrl={brand.logoUrl}
          basePath={basePath}
          menuItems={menuItems}
        />
        {/* grid-cols-1 explícito en celular: sin plantilla de columnas, la
            columna implícita crece hasta el ancho real de la foto (las de
            Shopify son de 2000px+) y la página se desborda de lado.
            Tailwind arma las columnas con minmax(0, 1fr), que es lo que lo
            evita. Ver conversación del 2026-09-30. */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-14">
          <div className="min-w-0">
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
              {reviewData && reviewData.count > 0 && (
                <a href="#opiniones" className="mt-1 inline-flex items-center gap-2 text-xs text-brand-ink-soft hover:underline">
                  <Stars value={reviewData.average} />
                  {reviewData.count} {reviewData.count === 1 ? "opinión" : "opiniones"}
                </a>
              )}
            </div>

            {!product.hasVariants && (
              <div className="flex items-center gap-3 flex-wrap">
                <ProductPrice
                  price={Number(product.price)}
                  compareAtPrice={product.compareAtPrice != null ? Number(product.compareAtPrice) : null}
                  className="text-2xl"
                />
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

                <QuantityAddToCart
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

        {/* La descripción va debajo de foto + compra, a todo el ancho y con
            el título centrado — como en la tienda Shopify de referencia
            (la marca: "y debajo la caja de descripción"). Antes iba en la
            columna derecha, entre el precio y el botón. Ver conversación
            del 2026-09-30. */}
        {product.description && (
          <section className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-14">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-brand-ink text-center mb-6">
              Descripción
            </h2>
            <div
              className="rich-text-content text-sm text-brand-ink max-w-5xl mx-auto"
              // Ya viene saneado desde brand-store-product-service.ts al
              // guardar — se vuelve a sanear acá por si algún otro camino
              // de escritura (ej. una futura sincronización) se lo salta.
              dangerouslySetInnerHTML={{
                __html: sanitizeProductDescription(product.description),
              }}
            />
          </section>
        )}

        {reviewData && (
          <ProductReviews
            brandSlug={slug}
            productId={product.id}
            average={reviewData.average}
            count={reviewData.count}
            reviews={reviewData.reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
          />
        )}

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
          <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-14">
            <h2 className="font-display text-lg font-semibold text-brand-ink mb-4">
              {productDetail.relatedTitles.alternative}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={toCardProduct(p)} basePath={basePath} />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
