import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { ProductPrice } from "@/components/storefront/product-card";
import type { CatalogProduct } from "./types";

/// Lista vertical, sin tarjetas ni bordes — el texto lleva el peso, no la
/// imagen (que queda chica, redonda). Pensada para catálogos cortos y
/// curados, tipo boutique — todo lo contrario a un grid denso.
export function MinimalTemplate({
  products,
  basePath,
}: {
  products: CatalogProduct[];
  basePath: string;
}) {
  return (
    <div className="divide-y divide-brand-line">
      {products.map((product) => (
        <div key={product.id} className="flex items-center gap-5 py-6">
          <Link
            href={`${basePath}/${product.slug}`}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 bg-brand-accent-soft"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : null}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`${basePath}/${product.slug}`}>
              {product.type === "SERVICE" && (
                <p className="text-[10px] font-mono text-brand-accent mb-0.5">
                  SERVICIO
                </p>
              )}
              {product.type === "DIGITAL" && (
                <p className="text-[10px] font-mono text-brand-accent mb-0.5">
                  DIGITAL
                </p>
              )}
              <p className="font-display text-base text-brand-ink truncate">
                {product.name}
              </p>
            </Link>
            <ProductPrice
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              className="text-sm font-mono mt-1"
            />
          </div>
          <div className="shrink-0">
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
              className="border border-brand-ink text-brand-ink rounded-full px-4 py-1.5 text-xs font-medium hover:bg-brand-ink hover:text-white transition-colors disabled:opacity-40"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
