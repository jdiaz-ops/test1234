import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import {
  CARD_BUTTON_CLASS,
  CARD_PRIMARY_BUTTON_CLASS,
  DiscountBadge,
  ProductPrice,
} from "@/components/storefront/product-card";
import type { ThemeConfig } from "@/lib/brand-theme";

type CollectionProduct = {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
};

/// Tarjeta de producto de las landing de colección y del buscador — a
/// diferencia del catálogo principal (que usa la plantilla elegida en
/// Plantilla: Clásica/Minimal/Editorial), acá es siempre esta misma
/// tarjeta, fija de a 2 por fila en celular: imagen, título, precio y los
/// dos botones ("Ver producto" + "Agregar al carrito") — cada elemento se
/// prende/apaga desde Diseño → Colecciones. Ver conversación del
/// 2026-09-14. Mismo estilo sin caja que ProductCard (ver ahí).
export function CollectionProductGrid({
  products,
  basePath,
  config,
}: {
  products: CollectionProduct[];
  basePath: string;
  config: ThemeConfig["collections"];
}) {
  return (
    // Fijo de a 2 en celular (pedido explícito) y 4 por fila en
    // computadora, como la página de colección de la tienda Shopify que la
    // marca tomó de referencia. Ver conversación del 2026-09-30.
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {products.map((product) => {
        const href = `${basePath}/${product.slug}`;
        return (
          <div key={product.id} className="flex flex-col">
            {config.showImage && (
              <Link href={href} className="relative block bg-brand-accent-soft">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square" />
                )}
                <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} />
              </Link>
            )}
            <div className="pt-3 flex flex-col gap-1.5 flex-1">
              {config.showTitle && (
                <Link href={href}>
                  {product.type === "SERVICE" && (
                    <p className="text-[10px] font-mono text-brand-accent mb-0.5">SERVICIO</p>
                  )}
                  {product.type === "DIGITAL" && (
                    <p className="text-[10px] font-mono text-brand-accent mb-0.5">DIGITAL</p>
                  )}
                  <p className="text-sm font-semibold text-brand-ink leading-snug line-clamp-2">
                    {product.name}
                  </p>
                </Link>
              )}
              <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} className="text-lg" />
              {(config.showViewProductButton || config.showAddToCartButton) && (
                <div className="mt-auto pt-1 flex flex-col gap-1.5">
                  {config.showViewProductButton && (
                    <Link
                      href={href}
                      className={`${CARD_BUTTON_CLASS} block text-center border border-brand-ink text-brand-ink hover:bg-brand-ink hover:text-white transition-colors`}
                    >
                      Ver producto
                    </Link>
                  )}
                  {config.showAddToCartButton && (
                    <AddToCartButton
                      basePath={basePath}
                      product={{
                        id: product.id,
                        slug: product.slug ?? "",
                        name: product.name,
                        price: product.price,
                        imageUrl: product.imageUrl,
                        stock: product.stock,
                        type: product.type,
                      }}
                      className={`${CARD_BUTTON_CLASS} ${CARD_PRIMARY_BUTTON_CLASS}`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
